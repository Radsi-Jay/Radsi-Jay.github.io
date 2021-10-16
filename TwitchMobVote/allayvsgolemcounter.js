

const client = new tmi.Client({
	channels: [ 'minecraft' ]
});

client.connect();

let glare = 0;
let allay = 0;
let golem = 0;

let glareText = document.getElementById("glare");
let allayText = document.getElementById("allay");
let golemText = document.getElementById("golem");

client.on('message', (channel, tags, message, self) => {
	if(message.toLowerCase().includes("glare")) {
        glare++;
        glareText.innerHTML = glare;
    }
    if(message.toLowerCase().includes("allay")) {
        allay++;
        allayText.innerHTML = allay;
    }
    if(message.toLowerCase().includes("golem")) {
        golem++;
        golemText.innerHTML = golem;
    }
});
	