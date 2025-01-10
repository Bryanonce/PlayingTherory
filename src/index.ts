import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Permite todas las peticiones
  },
});

interface Room {
  players: string[];
  observers: string[];
  choices: (string | null)[];
  scores: { [key: string]: number };
}

let rooms: { [key: string]: Room } = {}; // Almacena las salas y sus jugadores

app.get('/', (req, res) => {
  res.send('Servidor de juego');
});

io.on('connection', (socket) => {
  console.log('Nuevo usuario conectado');

  // Unirse a una sala
  socket.on('joinRoom', ({ room, name, isObserver }: { room: string; name: string; isObserver: boolean }) => {
    if (!rooms[room]) {
      rooms[room] = {
        players: [],
        observers: [],
        choices: [null, null],
        scores: {},
      };
    }

    if (isObserver) {
      if (rooms[room].observers.length < 20) {
        rooms[room].observers.push(name); // Se une como observador
      } else {
        socket.emit('error', 'La sala ya tiene el máximo de observadores');
        return;
      }
    } else {
      if (rooms[room].players.length < 2) {
        rooms[room].players.push(name); // Se une como jugador
        rooms[room].scores[name] = 0;
      } else {
        socket.emit('error', 'La sala ya está llena de jugadores');
        return;
      }
    }

    console.log(rooms)
    socket.join(room);
    io.to(room).emit('updatePlayers', rooms[room].players);
  });

  // Jugada
  socket.on('play', ({ room, name, choice }: { room: string; name: string; choice: string }) => {
    const currentRoom = rooms[room];
    if (!currentRoom) return;

    const playerIndex = currentRoom.players.indexOf(name);
    if (playerIndex === -1) return; // Verifica si el jugador existe

    currentRoom.choices[playerIndex] = choice;

    // Verifica si ambos jugadores han hecho su jugada
    if (currentRoom.choices.every((choice) => choice !== null)) {
      let result = '';
      if (currentRoom.choices[0] === 'Cooperate' && currentRoom.choices[1] === 'Cooperate') {
        result = 'Ambos cooperaron. Ganadores!';
        currentRoom.scores[currentRoom.players[0]] += 3;
        currentRoom.scores[currentRoom.players[1]] += 3;
      } else if (currentRoom.choices[0] === 'Not Cooperate' && currentRoom.choices[1] === 'Not Cooperate') {
        result = 'Ambos no cooperaron. Empate';
        currentRoom.scores[currentRoom.players[0]] += 1;
        currentRoom.scores[currentRoom.players[1]] += 1;
      } else {
        result = currentRoom.choices[0] === 'Cooperate' ? `${currentRoom.players[1]} no cooperó. ${currentRoom.players[0]} pierde.` : `${currentRoom.players[0]} no cooperó. ${currentRoom.players[1]} pierde.`;
        if (currentRoom.choices[0] === 'Cooperate') {
          currentRoom.scores[currentRoom.players[0]] += 0;
          currentRoom.scores[currentRoom.players[1]] += 5;
        } else {
          currentRoom.scores[currentRoom.players[0]] += 5;
          currentRoom.scores[currentRoom.players[1]] += 0;
        }
      }

      // Emitir resultado a todos los participantes (jugadores y observadores)
      io.to(room).emit('gameResult', result);
      io.to(room).emit('updateScores', currentRoom.scores);

      // Resetear elecciones para la próxima ronda
      currentRoom.choices = [null, null];
    }
  });

  // Desconectar jugador
  socket.on('disconnect', () => {
    console.log('Usuario desconectado');
  });
});

server.listen(80, () => {
  console.log('Servidor corriendo en el puerto 80');
});
