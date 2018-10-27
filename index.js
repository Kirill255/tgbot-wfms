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
const mongoose = require("mongoose");

const Film = require("./src/models/Film");

mongoose.set("debug", true);
// mongoose.set("useCreateIndex", true);
mongoose.Promise = global.Promise;
mongoose.connect(process.env.DB_URL, {
    useNewUrlParser: true,
    reconnectTries: Number.MAX_VALUE,
}).then(
    () => { console.log("Mongodb connected"); },
    err => { console.log("!!!!! ", err); }
);

// у нас есть первоначальные данные в database.json, чтобы занести(проинициализировать) их в нашу базу mongo
// мы запустим цикл по файлу чтобы создать коллекции, а дальше закомментируем эти строчки, они нужны только для первого запуска
// можно конечно и вручную создавать документы в mongo, но зачем?
// const database = require("./database.json");
// database.films.forEach(f => new Film(f).save().catch(err => console.log('err :', err)));


// =====================================
const keyboards = require("./keyboards");
const kb = require("./keyboard-buttons");

let TOKEN = process.env.TOKEN || "";
const PROXY = process.env.PROXY || ""; // https://hidemyna.me/ru/proxy-list/?type=s#list

const bot = new TelegramBot(TOKEN, {
    polling: true,
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
    // const html = `
    //     <b>Debug, message from ${msg.from.first_name}</b>
    //     <pre>${JSON.stringify(msg, null, 2)}</pre>
    // `;
    // bot.sendMessage(msg.chat.id, html, {
    //     parse_mode: "HTML"
    // });
});

bot.onText(/\/start/i, (msg) => {
    const { id } = msg.chat;
    const { first_name } = msg.from;
    const welcome = `Здравствуйте, ${first_name}.\nВыберите команду для начала работы:`;
    bot.sendMessage(id, welcome, {
        reply_markup: {
            keyboard: keyboards.home
        }
    });
});

bot.on("text", (msg) => {
    const { id, first_name } = msg.chat;
    const { text } = msg;
    switch (text) {
        // кнопка Сейчас в кино
        case kb.home.films:
            bot.sendMessage(id, "Выберите жанр:", {
                reply_markup: {
                    keyboard: keyboards.films
                }
            });
            break;
        // при нажатии Сейчас в кино, появляются другие три кнопки
        case kb.film.random:
            sendFilmsByQuery(id, {})
            break;
        case kb.film.action:
            sendFilmsByQuery(id, { type: "action" })
            break;
        case kb.film.comedy:
            sendFilmsByQuery(id, { type: "comedy" })
            break;
        //  кнопка Избранное
        case kb.home.favorite:

            break;
        //  кнопка Кинотеатры
        case kb.home.cinemas:

            break;
        //  кнопка Назад
        case kb.back:
            bot.sendMessage(id, "Что хотите посмотреть?", {
                reply_markup: {
                    keyboard: keyboards.home
                }
            });
            break;
        default:
            break;
    }

});

bot.on("inline_query", (query) => {
    // // console.log('object :', JSON.stringify(query, null, 2));
    // const { id } = query;

    // let results = [];
    // for (let i = 0; i < 5; i++) {
    //     results.push({
    //         type: "article",
    //         id: i.toString(),
    //         title: "Title" + i,
    //         input_message_content: {
    //             message_text: `Article ${i + 1}`
    //         }
    //     })
    // }

    // bot.answerInlineQuery(id, results, {
    //     cache_time: 0
    // });
});



const sendFilmsByQuery = (chatId, query) => {
    Film.find(query).then(films => {
        // console.log('films :', films);
        let html = films.map((film, i) => {
            return `<b>${i + 1}</b> ${film.name} — /f${film.uuid}`
        }).join("\n");

        bot.sendMessage(chatId, html, {
            parse_mode: "HTML",
            reply_markup: {
                keyboard: keyboards.films
            }
        });
    })
};


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