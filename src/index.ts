import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

interface Room {
  players: string[];
  choices: (string | null)[];
  scores: { [player: string]: number };
}

let rooms: { [key: string]: Room } = {}; // Guarda las salas y su información

io.on('connection', (socket) => {
  console.log('Un usuario se conectó');

  socket.on('joinRoom', ({ room, name }) => {
    let currentRoom = rooms[room];
    if (!currentRoom) {
      currentRoom = { players: [], choices: [null, null], scores: {} };
      rooms[room] = currentRoom;
    }

    if (currentRoom.players.length < 2) {
      currentRoom.players.push(name);
      currentRoom.scores[name] = 0;
      socket.join(room);
      io.to(room).emit('updatePlayers', currentRoom.players);
    } else {
      socket.emit('waitingForOtherPlayer', 'La sala ya está llena. Espera a que termine la ronda actual.');
    }
  });

  socket.on('play', ({ room, name, choice }) => {
    let currentRoom = rooms[room];
    if (!currentRoom) return;

    const playerIndex = currentRoom.players.indexOf(name);
    currentRoom.choices[playerIndex] = choice;

    // Si ambos jugadores hicieron su elección, calcula el resultado
    if (currentRoom.choices.every(choice => choice !== null)) {
      const [choice1, choice2] = currentRoom.choices;
      let resultMessage = '';

      if (choice1 === 'Cooperate' && choice2 === 'Cooperate') {
        currentRoom.scores[currentRoom.players[0]] += 3;
        currentRoom.scores[currentRoom.players[1]] += 3;
        resultMessage = 'Ambos cooperaron, ¡Ambos ganan!';
      } else if (choice1 === 'Not Cooperate' && choice2 === 'Not Cooperate') {
        currentRoom.scores[currentRoom.players[0]] += 1;
        currentRoom.scores[currentRoom.players[1]] += 1;
        resultMessage = 'Ninguno cooperó, ¡Empate!';
      } else if (choice1 === 'Cooperate' && choice2 === 'Not Cooperate') {
        currentRoom.scores[currentRoom.players[1]] += 5;
        resultMessage = `${currentRoom.players[1]} no cooperó, pero ${currentRoom.players[0]} cooperó.`;
      } else if (choice1 === 'Not Cooperate' && choice2 === 'Cooperate') {
        currentRoom.scores[currentRoom.players[0]] += 5;
        resultMessage = `${currentRoom.players[0]} no cooperó, pero ${currentRoom.players[1]} cooperó.`;
      }

      // Genera el arreglo con nombres y puntajes
      const scoresWithNames = currentRoom.players.map((player: string) => ({
        name: player,
        score: currentRoom.scores[player]
      }));

      io.to(room).emit('gameResult', { message: resultMessage, scores: scoresWithNames });

      // Restablecer las elecciones para la siguiente ronda
      currentRoom.choices = [null, null];
    }
  });

  socket.on('disconnect', () => {
    console.log('Un usuario se desconectó');
  });
});

server.listen(80, () => {
  console.log('Servidor corriendo en http://localhost:80');
});
