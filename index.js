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
const geolib = require("geolib");
const _ = require("lodash");

const Film = require("./src/models/Film");
const Cinema = require("./src/models/Cinema");
const User = require("./src/models/User");

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
// database.cinemas.forEach(c => new Cinema(c).save().catch(err => console.log('err :', err)));


// =====================================

const ACTION_TYPE = {
    TOGGLE_FAVORITE_FILM: "tff",
    SHOW_CINEMAS: "sc",
    SHOW_CINEMAS_MAP: "scm",
    SHOW_FILMS: "sf"
};

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
            showFavoriteFilms(id, msg.from.id)
            break;
        //  кнопка Кинотеатры
        case kb.home.cinemas:
            bot.sendMessage(id, "Отправьте местоположение", {
                reply_markup: {
                    keyboard: keyboards.cinemas
                }
            })
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

// у нас ссылки на фильм такого вида /ff567 (/f + uuid), чтобы найти их мы ставим этот обработчик
// всё что после /f засовываем в match, тоесть в match у нас наш uuid из базы
bot.onText(/\/f(.+)/, (msg, [_, match]) => {
    const { id } = msg.chat;
    // console.log('match :', match);
    let uuid = match;

    // для того чтобы можно было добалять фильмы в избранное юзера, нам нужно достать этого юзера, а также нам нужен сам фильм 
    // User.findOne({ telegram_id: msg.from.id }) и Film.findOne({ uuid: uuid })
    // свяжем эти два промиса
    Promise.all([
        Film.findOne({ uuid: uuid }),
        User.findOne({ telegram_id: msg.from.id })
    ]).then(([film, user]) => {
        let isFavorite = false; // сделаем флаг

        if (user) {
            isFavorite = user.films.indexOf(film.uuid) !== -1; // смотрим добавлен ли фильм в избранное
        }

        let favoriteText = isFavorite ? "Удалить из избранного" : "Добавить в избранное"; // динамический текст на кнопке

        let caption = `Название: ${film.name}\nГод: ${film.year}\nРейтинг: ${film.rate}\nДлительность: ${film.length}\nСтрана: ${film.country}`;

        bot.sendPhoto(id, film.picture, {
            caption: caption,
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: favoriteText,
                            callback_data: JSON.stringify({ // callback_data - должен быть строкой, а мы хотим передать объект, поэтому JSON.stringify()
                                type: ACTION_TYPE.TOGGLE_FAVORITE_FILM,
                                filmUuid: film.uuid,
                                isFavorite: isFavorite
                            })
                        },
                        {
                            text: "Показать кинотеатры",
                            callback_data: JSON.stringify({
                                type: ACTION_TYPE.SHOW_CINEMAS,
                                cinemaUuids: film.cinemas
                            })
                        }
                    ],
                    [{ text: `Кинопоиск ${film.name}`, url: film.link }]
                ]
            }
        });
    });


    // Film.findOne({ uuid: uuid }).then(film => {
    //     // console.log('film :', film);
    // });
});

bot.onText(/\/c(.+)/, (msg, [_, match]) => {
    const { id } = msg.chat;
    // console.log('match :', match);
    let uuid = match;
    Cinema.findOne({ uuid: uuid }).then(cinema => {
        // console.log('film :', film);

        bot.sendMessage(id, `Кинотеатр ${cinema.name}`, {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: cinema.name, url: cinema.url },
                        {
                            text: "Показать на карте",
                            callback_data: JSON.stringify({
                                type: ACTION_TYPE.SHOW_CINEMAS_MAP,
                                lat: cinema.location.latitude,
                                lon: cinema.location.longitude
                            })
                        }
                    ],
                    [
                        {
                            text: "Показать фильмы",
                            callback_data: JSON.stringify({
                                type: ACTION_TYPE.SHOW_FILMS,
                                filmUuids: cinema.films
                            })
                        }
                    ]
                ]
            }
        });
    });
});

bot.on("location", (msg) => {
    const { id } = msg.chat;
    const { location } = msg;
    getCinemasInCoords(id, location);
});

bot.on("callback_query", (query) => {
    // console.log('query :', query);
    // console.log('query :', query.data); // '{"type":"sc","cinemaUuids":["c123","c345"]}' - строка
    const userId = query.from.id;

    let data;
    try {
        data = JSON.parse(query.data); // парсим строку
    } catch (error) {
        throw new Error("Data is not an object")
    }

    let { type } = data; // берём type

    if (type === ACTION_TYPE.TOGGLE_FAVORITE_FILM) {
        toggleFavoriteFilm(userId, query.id, data);
    } else if (type === ACTION_TYPE.SHOW_FILMS) {
        sendFilmsByQuery(userId, { uuid: { "$in": data.filmUuids } }) // эта функция нам полностью подходит, хоть и была написана для выбора фильмов по жанру, там мы передавали chatId, а сейчас userId, но для функции нет никакой разницы, на самом деле это одно и тоже значение, просто оно хранится в разных полях в объектах telegram
    } else if (type === ACTION_TYPE.SHOW_CINEMAS) {
        sendCinemasByQuery(userId, { uuid: { "$in": data.cinemaUuids } })
    } else if (type === ACTION_TYPE.SHOW_CINEMAS_MAP) {
        let { lat, lon } = data;
        bot.sendLocation(query.message.chat.id, lat, lon)
    }

});

bot.on("inline_query", (query) => {
    // console.log('object :', JSON.stringify(query, null, 2));
    const { id } = query;

    Film.find({}).then(films => {
        let results = films.map((film, i) => {
            let caption = `Название: ${film.name}\nГод: ${film.year}\nРейтинг: ${film.rate}\nДлительность: ${film.length}\nСтрана: ${film.country}`;

            return {
                type: "photo",
                id: film.uuid,
                photo_url: film.picture,
                thumb_url: film.picture,
                caption: caption,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: `Кинопоиск ${film.name}`, url: film.link }]
                    ]
                }
            }
        });

        bot.answerInlineQuery(id, results, {
            cache_time: 0
        });
    });
});



const sendFilmsByQuery = (chatId, query) => {
    console.log('chatId :', chatId);
    Film.find(query).then(films => {
        // console.log('films :', films);
        let html = films.map((film, i) => {
            return `<b>${i + 1}</b> ${film.name} — /f${film.uuid}`
        }).join("\n");

        sendHTML(chatId, html, "films");
    })
};

const sendHTML = (chatId, html, kbName = null) => {
    const opts = {
        parse_mode: "HTML"
    };

    if (kbName) {
        opts["reply_markup"] = {
            keyboard: keyboards[kbName]
        }
    }

    bot.sendMessage(chatId, html, opts);
};

const getCinemasInCoords = (chatId, location) => {
    Cinema.find({}).then(cinemas => {
        // console.log('cinemas :', cinemas);
        // высчитать расстояние до кинотеатра
        cinemas.forEach(c => {
            c.distance = geolib.getDistance(location, c.location) / 1000 // теперь значение получается в км, было в м
        });
        // отсортировать
        cinemas = _.sortBy(cinemas, "distance");

        let html = cinemas.map((cinema, i) => {
            return `<b>${i + 1}</b> ${cinema.name}. <em>Расстояние: </em><b>${cinema.distance} км.</b> — /c${cinema.uuid}`
        }).join("\n");

        sendHTML(chatId, html, "home");
    });
};

const toggleFavoriteFilm = (userId, queryId, { filmUuid, isFavorite }) => {
    let userPromise; // сюда сохраним пользователя

    User.findOne({ telegram_id: userId }).then(user => {
        if (user) { // если есть пользователь
            if (isFavorite) { // если есть в избранных, то нужно удалить
                user.films = user.films.filter(fUuid => fUuid !== filmUuid);
            } else { // если нет, то надо добавить
                user.films.push(filmUuid);
            }
            userPromise = user;
        } else { // если нет, то нужно создать
            userPromise = new User({
                telegram_id: userId,
                films: [filmUuid]
            });
        }

        let answerText = isFavorite ? "Удалено" : "Добавлено";

        userPromise.save().then(_ => {
            bot.answerCallbackQuery(queryId, {
                text: answerText
            })
        }).catch(err => console.log('err :', err));
    }).catch(err => console.log('err :', err));
}

const showFavoriteFilms = (chatId, userId) => {
    User.findOne({ telegram_id: userId }).then(user => {
        if (user) {
            Film.find({ uuid: { "$in": user.films } }).then(films => {
                let html;
                if (films.length) {
                    html = films.map((film, i) => {
                        return `<b>${i + 1}</b> ${film.name} <i>${film.rate}</i> — /f${film.uuid}`;
                    }).join("\n");
                } else {
                    html = "Вы пока ничего не добавили!";
                }
                sendHTML(chatId, html, "home");
            }).catch(err => console.log('err :', err));
        } else {
            sendHTML(chatId, "Вы пока ничего не добавили!", "home");
        }
    }).catch(err => console.log('err :', err));
}

const sendCinemasByQuery = (userId, query) => {
    Cinema.find(query).then(cinemas => {
        let html = cinemas.map((cinema, i) => {
            return `<b>${i + 1}</b> ${cinema.name} — /c${cinema.uuid}`;
        }).join("\n");

        sendHTML(userId, html, "home");
    });
}

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