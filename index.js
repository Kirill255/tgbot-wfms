require("dotenv").config();

// const express = require("express");
// const fetch = require("node-fetch");
// const request = require("request");
// const app = express();
// const PORT = process.env.PORT || 5000;

// temporally fix cancellation of promises https://github.com/yagop/node-telegram-bot-api/issues/319. module.js:652:30
process.env.NTBA_FIX_319 = 1;
// temporally fix https://github.com/yagop/node-telegram-bot-api/blob/master/doc/usage.md#sending-files
process.env.NTBA_FIX_350 = 1;

const TelegramBot = require("node-telegram-bot-api");

let TOKEN = process.env.TOKEN || "";
const PROXY = process.env.PROXY || ""; // https://hidemyna.me/ru/proxy-list/?type=s#list

// https://github.com/yagop/node-telegram-bot-api/blob/master/examples/polling.js

const bot = new TelegramBot(TOKEN, {
    // polling: true,
    polling: {
        interval: 300,
        autoStart: true,
        params: {
            timeout: 10
        }
    },
    request: {
        proxy: PROXY
    },
});

/* 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
    // res.send("GET request to the homepage");
    res.status(200).end();
});

// POST method route
// app.post(`/bot${TOKEN}`, (req, res) => {
//     bot.processUpdate(req.body);
//     // res.status(200).end();
//     res.sendStatus(200);
// });

app.use((req, res, next) => {
    res.status(404).send("Not found!");
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send("Something broke!");
});

app.listen(PORT, () => console.log("Server start"));
*/

bot.on("message", (msg) => {
    // bot.sendMessage(msg.chat.id, JSON.stringify(msg, null, 2)); // для отладки, смотрим что приходит
    const html = `
        <b>Debug, message from ${msg.from.first_name}</b>
        <pre>${JSON.stringify(msg, null, 2)}</pre>
    `;
    bot.sendMessage(msg.chat.id, html, {
        parse_mode: "HTML"
    });
});

bot.onText(/\/start/i, (msg) => {
    const { id } = msg.chat;
    const opts = {
        reply_markup: JSON.stringify({
            resize_keyboard: true,
            one_time_keyboard: true,
            keyboard: [
                ["/menu", "/help"],
            ]
        })
    };
    bot.sendMessage(id, "Welcome", opts);
});

bot.onText(/\/help (.+)/i, (msg, [_, match]) => {
    const { id } = msg.chat;
    const opts = {
        reply_markup: JSON.stringify({
            resize_keyboard: true,
            one_time_keyboard: true,
            keyboard: [
                ["/menu", "/help"],
            ]
        })
    };
    bot.sendMessage(id, match, opts);
});

// смайлы https://ru.piliapp.com/emoji/list/smileys-people/
bot.on("text", (msg) => {
    const { id, first_name } = msg.chat;

    const hello = "привет"
    if (msg.text.toLowerCase().includes(hello)) {
        bot.sendMessage(id, `Привет, ${first_name} 😀!`);
    }

    const bye = "пока"
    if (msg.text.toLowerCase().includes(bye)) {
        bot.sendMessage(id, `Пока, ${first_name} 😟!`);
    }
});

bot.on("inline_query", (query) => {
    // console.log('object :', JSON.stringify(query, null, 2));
    const { id } = query;

    let results = [];
    for (let i = 0; i < 5; i++) {
        results.push({
            type: "article",
            id: i.toString(),
            title: "Title" + i,
            input_message_content: {
                message_text: `Article ${i + 1}`
            }
        })
    }

    bot.answerInlineQuery(id, results, {
        cache_time: 0
    });
});

console.log("Start bot");



// error handling
bot.on("polling_error", (error) => {
    console.log("=== polling_error ===");
    console.log(error);
});


process.on("uncaughtException", (error) => {
    let time = new Date();
    console.log("=== uncaughtException ===");
    console.log("TIME:", time);
    console.log("NODE_CODE:", error.code);
    console.log("MSG:", error.message);
    console.log("STACK:", error.stack);
});

process.on("unhandledRejection", (error) => {
    let time = new Date();
    console.log("=== unhandledRejection ===");
    console.log("TIME:", time);
    console.log("NODE_CODE:", error.code);
    console.log("MSG:", error.message);
    console.log("STACK:", error.stack);
});