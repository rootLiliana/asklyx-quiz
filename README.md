# 🎮 Asklyx Quiz Live

Una plataforma de quizzes en tiempo real inspirada en Kahoot y Mentimeter, desarrollada para sesiones educativas y dinámicas de aprendizaje.

## ❤️ Agradecimientos

A todas las participantes que probaron el sistema durante las sesiones de Tecnolochicas PRO y ayudaron a validar el MVP con más de 50 usuarios simultáneos.


## 🚀 Demo

Frontend:
https://asklyx-quiz-sandy.vercel.app

Backend:
https://asklyx-quiz.onrender.com

---

## ✨ Características

- Creación de salas de juego
- Código único por partida
- Participación en tiempo real
- Sistema de puntaje basado en velocidad
- Ranking dinámico
- Podio final animado
- Diseño responsive para computadora y móvil
- Interfaz moderna con animaciones

---

## 🛠️ Tecnologías utilizadas

### Frontend

- React
- TypeScript
- Vite
- TailwindCSS
- Framer Motion
- React Confetti
- React Router DOM

### Backend

- Node.js
- Express
- TypeScript
- CORS

---

## 📸 Flujo de uso

### 1. El experto crea una sala

Desde el panel de Host se genera un código único:

```

BEDU-3346

```

### 2. Los participantes ingresan

Acceden a:

```

/join

```

y capturan:

- Nombre
- Código de juego

### 3. Comienza el quiz

El Host inicia la sesión y controla el avance entre preguntas.

### 4. Sistema de puntos

Cada respuesta correcta suma puntos según la rapidez:

```ts
score += timeLeft * 100;
```

Ejemplo:

| Tiempo restante | Puntos |
| --------------- | ------- |
| 10 segundos | 1000 |
| 8 segundos | 800 |
| 5 segundos | 500 |

---

## 🏆 Ranking

Al finalizar la partida se genera un podio con:

🥇 Primer lugar

🥈 Segundo lugar

🥉 Tercer lugar

Incluyendo efectos visuales y celebración con confeti.

---

## 📂 Estructura del proyecto

```

quiz-live/
│
├── src/
│ ├── pages/
│ │ ├── Home.tsx
│ │ ├── Host.tsx
│ │ ├── Join.tsx
│ │ └── Quiz.tsx
│ │
│ ├── config/
│ │ └── api.ts
│ │
│ └── types/
│
├── server/
│ ├── src/
│ │ ├── index.ts
│ │ ├── gameManager.ts
│ │ └── types/
│ │
│ └── package.json
│
└── README.md

```

---

## 🔧 Instalación local

### Frontend

```bash
npm install
npm run dev
```

Aplicación disponible en:

```bash
http://localhost:5173
```

### Backend

```bash
cd server

npm install

npm run dev
```

Servidor disponible en:

```bash
http://localhost:3001
```

---

## 🌎 Variables de entorno

Frontend:

```env
VITE_API_URL=https://asklyx-quiz.onrender.com
```

---

## 📝 Ejemplo de preguntas

```json
{
  "id": "1",
  "text": "¿Qué método HTTP se utiliza comúnmente para obtener datos de una API en Python?",
  "options": [
    "POST",
    "GET",
    "PUT",
    "DELETE"
  ],
  "correctAnswer": 1
}
```

---

## 💡 Próximas mejoras

- Autenticación para Host
- Carga de preguntas desde JSON
- Editor visual de preguntas
- Leaderboard en tiempo real
- Temporizador sincronizado desde servidor
- Persistencia en base de datos
- WebSockets
- Exportación de resultados
- Código QR para acceso rápido

---

## 👩‍💻 Autora

**Rocío Liliana Estevez**

Desarrollado como proyecto educativo para Tecnolochicas PRO y sesiones de formación en Ciencia de Datos.

GitHub:
https://github.com/rootLiliana

---


```
