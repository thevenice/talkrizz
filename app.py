import socketio
import uvicorn
import asyncio
import uvloop
import random
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Use uvloop for improved performance
asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())

# Create a Socket.IO server with proper CORS configuration
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=[
        'http://127.0.0.1:5500',
        'http://localhost:5500',
        'http://talkrizz.com',
        'https://talkrizz.com'
    ],
    namespaces=['/']
)

app = socketio.ASGIApp(sio)

active_users = set()
user_rooms = {}
users_looking_for_partner = set()

@sio.event
async def connect(sid, environ):
    logger.debug(f"User {sid} connected")
    active_users.add(sid)
    await sio.emit('connect_response', {'status': 'connected'}, to=sid)

@sio.event
async def disconnect(sid):
    logger.debug(f"User {sid} disconnected")
    active_users.remove(sid)
    users_looking_for_partner.discard(sid)
    if sid in user_rooms:
        await leave_room(sid)

@sio.event
async def find_partner(sid):
    logger.debug(f"User {sid} is looking for a partner")
    if sid in user_rooms:
        await leave_room(sid)
    
    if sid in users_looking_for_partner:
        await sio.emit('error', {'message': 'You are already looking for a partner'}, to=sid)
        return

    users_looking_for_partner.add(sid)
    
    available_partners = list(users_looking_for_partner - {sid})
    logger.debug(f"Available partners for {sid}: {available_partners}")
    
    if available_partners:
        partner_sid = random.choice(available_partners)
        room = f"room_{sid}_{partner_sid}"
        user_rooms[sid] = room
        user_rooms[partner_sid] = room
        users_looking_for_partner.remove(sid)
        users_looking_for_partner.remove(partner_sid)
        
        await sio.enter_room(sid, room)
        await sio.enter_room(partner_sid, room)
        await sio.emit('partner_found', {'room': room}, to=sid)
        await sio.emit('partner_found', {'room': room}, to=partner_sid)
        logger.debug(f"Paired users {sid} and {partner_sid} in room {room}")
    else:
        await sio.emit('waiting_for_partner', to=sid)
        logger.debug(f"User {sid} is waiting for a partner")

@sio.event
async def leave_room(sid):
    logger.debug(f"User {sid} requested to leave room")
    if sid in user_rooms:
        room = user_rooms[sid]
        partner_sid = next((user for user, user_room in user_rooms.items() if user_room == room and user != sid), None)
        del user_rooms[sid]
        if partner_sid:
            del user_rooms[partner_sid]
            await sio.emit('partner_left', to=partner_sid)
        await sio.leave_room(sid, room)
        if partner_sid:
            await sio.leave_room(partner_sid, room)
        logger.debug(f"User {sid} left room {room}")
    users_looking_for_partner.discard(sid)
    await sio.emit('left_room', to=sid)

@sio.event
async def send_message(sid, message):
    logger.debug(f"User {sid} sending message: {message}")
    if sid in user_rooms:
        room = user_rooms[sid]
        logger.debug(f"Sending message from {sid} to room {room}: {message}")
        await sio.emit('message', {'user': sid, 'message': message}, room=room, skip_sid=sid)
    else:
        logger.debug(f"User {sid} not in a room")
        await sio.emit('error', {'message': 'You are not in a chat'}, to=sid)

@sio.event
async def ping(sid):
    logger.debug(f"Received ping from {sid}")
    await sio.emit('pong', to=sid)

@sio.event
async def chat_error(sid, message):
    logger.error(f"Chat error for user {sid}: {message}")
    await sio.emit('chat_error', {'message': message}, to=sid)

if __name__ == '__main__':
    uvicorn.run(app, host='0.0.0.0', port=8001, workers=1)