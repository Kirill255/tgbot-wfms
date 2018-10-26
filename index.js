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

const inlineKeyboard = [
    [
        {
            "text": "Forward",
            "callback_data": "forward"
        },
        {
            "text": "Reply",
            "callback_data": "reply"
        }
    ],
    [
        {
            "text": "Edit",
            "callback_data": "edit"
        },
        {
            "text": "Delete",
            "callback_data": "delete"
        }
    ]
];


bot.on("message", (msg) => {
    // bot.sendMessage(msg.chat.id, JSON.stringify(msg, null, 2)); // для отладки, смотрим что приходит
    const html = `
        <b>Debug, message from ${msg.from.first_name}</b>
        <pre>${JSON.stringify(msg, null, 2)}</pre>
    `;
    // bot.sendMessage(msg.chat.id, html, {
    //     parse_mode: "HTML"
    // });
});

bot.onText(/\/start/i, (msg) => {
    const { id } = msg.chat;
    const opts = {
        reply_markup: JSON.stringify({
            inline_keyboard: inlineKeyboard
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

// это тестовый токен, для реальных данных нужна регистрация в яндекс-кассе
// 381764678:TEST:7217
// https://core.telegram.org/bots/payments
// https://kassa.yandex.ru/blog/telegram
bot.onText(/\/pay/i, (msg) => {
    const { id } = msg.chat;

    bot.sendInvoice(
        id,
        "Audi A4",
        "Description for best car",
        "some_payload",
        "381764678:TEST:7217",
        "SOME_RANDOM_STRING_KEY",
        "RUB",
        [
            {
                label: "audi_a4",
                amount: 30000 // это 300рублей в копейках, тоесть 300р * 100
            }
        ],
        {
            photo_url: "https://i.quto.ru/c533x400/4c1b6be47400d.jpeg",
            need_name: true,
            need_phone_number: true,
            is_flexible: true
        }
    );
});

bot.on("callback_query", (query) => {
    // console.log('object :', JSON.stringify(query, null, 2));
    const { id, data } = query;
    const { chat, message_id, text } = query.message;

    switch (data) {
        case "forward":
            // куда, откуда, что, можно пересылать и в другой чат, нужно только знать его id
            bot.forwardMessage(chat.id, chat.id, message_id)
            break;
        case "reply":
            bot.sendMessage(chat.id, "Отвечаем на сообщение", {
                reply_to_message_id: message_id
            });
            break;
        case "edit":
            bot.editMessageText(`${text} (edited)`, {
                chat_id: chat.id,
                message_id: message_id,
                reply_markup: JSON.stringify({
                    inline_keyboard: inlineKeyboard
                })
            });
            break;
        case "delete":
            bot.deleteMessage(chat.id, message_id)
            break;
    }

    const opts = {
        text: `Вы нажали ${data}`,
    };
    bot.answerCallbackQuery(id, opts)
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