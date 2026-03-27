
# Pytechka

Pytechka е web приложение, целящо да насърчава хората да прекарват повече време сред природата, но също така и да я опазва.

Потребителите могат да следват вече съществуващи пътеки или да създадат собствени. Това позволява на всеки да допринася за развитието.

Всеки потребител може да сигнализира за наличието на прекомерно количетво боклук. При обратна връзка от повече потребители се задейства кампания за почистване.


Всеки потребител получава медал за участие в различни сфери

|     | Trailer | Contribution   |Campaign            |
|-----| ------- | ---------------|--------------------|
| +3  | Rookie  | New guide      | Volunteer          |
| +10 | Junior  | Local guide    | Helper             |
| +20 | Senior  | Country guide  | Basically organizer| 


## Инсталация

1. Копиране на директорията 

```bash
  git clone github.com/KameZh/HackGorski12
```
2. Навигиране в директорията

```bash
  cd HackGorski12
```

3. Инсталиране на зависимости и ключове
* Навигирайте към папката на Frontend
```bash
    cd ./Frontent
```
Попълване на .env по модела на .env.template
След това изпълнете следните команди за активиране на страницата
```bash
    npm install --legacy-peer-deps
    npm run dev --host
```
* Навигирайте към папката на Backend
```bash
    cd ../Backend
```
Попълване на .env по модела на .env.template
```bash
    npm install express cors dotenv @clerk/clerk-sdk-node
    npm install 
    node server.js
```
Готови сте !

## Създатели 
Отбор *Gorski* с помощта на ментора *Александър Йорданов*

- [Kiks07](https://www.github.com/Kiks07Bg)
- [Kamen Zhekovski](https://www.github.com/KameZh)
- [Aleksandar Tachev](https://www.github.com/AleksTach)
- [Georgi Ivanov](https://www.github.com/Georgi-IV)

