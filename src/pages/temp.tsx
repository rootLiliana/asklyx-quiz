import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { API } from "../config/api";
import type { IceBreaker } from "../types/IceBreaker";

const [icebreaker, setIcebreaker] =
  useState<IceBreaker | null>(null);

const [answer, setAnswer] =
  useState("");

const [sent, setSent] =
  useState(false);

const navigate = useNavigate();

const code =
  localStorage.getItem("gameCode");

  const loadIceBreaker = useCallback(async () => {
  if (!code) return;

  const response = await fetch(
    `${API}/games/${code}/icebreaker`
  );

  if (!response.ok) return;

  const data =
    await response.json();

  if (!data.active) {
    navigate("/quiz");
    return;
  }

  setIcebreaker(data);

}, [code, navigate]);

useEffect(() => {

  void loadIceBreaker();

  const interval =
    setInterval(() => {
      void loadIceBreaker();
    }, 2000);

  return () =>
    clearInterval(interval);

}, [loadIceBreaker]);
const submitAnswer = async () => {

  const playerName =
    localStorage.getItem("playerName");

  if (!playerName) return;

  await fetch(
    `${API}/games/${code}/icebreaker/answer`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json"
      },
      body: JSON.stringify({
        playerName,
        text: answer,
      }),
    }
  );

  setSent(true);

};

if (!icebreaker) {
  return <h1>Cargando...</h1>;
}
return (

<div
className="
min-h-screen
bg-gradient-to-br
from-purple-900
via-indigo-900
to-black

flex
items-center
justify-center
p-6
"
>

<div
className="
bg-white/10
backdrop-blur-xl
rounded-3xl
p-10
w-full
max-w-3xl
"
>

<h1
className="
text-white
text-5xl
font-bold
text-center
mb-10
"
>

💬 Ice Breaker

</h1>

<h2
className="
text-fuchsia-300
text-3xl
font-bold
text-center
mb-8
"
>

{icebreaker.question}

</h2>

{!sent ? (

<>

<textarea

value={answer}

onChange={(e)=>
setAnswer(e.target.value)
}

placeholder="Escribe aquí..."

className="
w-full
h-40
rounded-xl
p-5
text-black
"
/>

<button

onClick={submitAnswer}

className="
mt-6
w-full
rounded-xl
bg-fuchsia-600
text-white
font-bold
p-4
"

>

Enviar

</button>

</>

) : (

<div
className="
text-center
text-white
"
>

<h2
className="
text-5xl
mb-4
"
>

🎉

</h2>

<p
className="
text-2xl
font-bold
"
>

¡Gracias por participar!

</p>

<p
className="
mt-4
text-lg
text-gray-300
"
>

Esperando a que inicie el quiz...

</p>

</div>

)}

</div>

</div>

);