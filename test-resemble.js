const fetch = require('node-fetch');

async function test() {
  const url = "https://f.cluster.resemble.ai/stream";
  const apiKey = "DUMMY"; // we can just check if we get 401 Unauthorized or 400 Bad Request
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "x-access-token": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      data: "Hello world",
      voice_uuid: "e040c5b3"
    })
  });
  console.log(response.status);
  console.log(await response.text());
}
test();
