
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

1. Клонирайте проекта и влезте в папката му.
```bash
    git clone github.com/KameZh/HackGorski12
```
2. Инсталирайте зависимостите и в двете поддиректории:
```bash
cd Backend && npm install
cd ../pytechka-frontend && npm install
```
3. Попълнете `.env` файловете по техните шаблони.
4. Стартирайте всичко от корена с една команда:
```bash
npm start
```
5. Ако отваряте приложението в localhost, не е нужно ngrok - frontendът използва локалния API proxy автоматично.

## Android app

1. Да, ngrok трябва да сочи към локалния backend на порт `5174`. Стартирайте го с:
```bash
ngrok http 5174
```
2. В app-а използвайте получената HTTPS ngrok URL в `pytechka-frontend/.env` за `VITE_API_BASE_URL` и `VITE_ANDROID_API_BASE_URL`.
3. Ако ngrok URL-а се промени, направете пълен restart:
```bash
# 1. Stop the old backend and ngrok processes
# 2. Start the backend again
npm start

# 3. Start ngrok again against port 5174
ngrok http 5174

# 4. Update pytechka-frontend/.env with the new HTTPS ngrok URL

# 5. Rebuild and resync Android
npm run android:build
npm run android:sync

# 6. Relaunch the Android app
```
4. За картата да използва локация на Android, устройството трябва да има разрешение за location и включена GPS/location услуга.
5. За Android билд изпълнете от корена:
```bash
npm run android:build
npm run android:sync
npm run android:open
```
6. За debug от Android Studio отворете `pytechka-frontend/android` и стартирайте приложението.

## Създатели 
Отбор *Gorski* с помощта на ментора *Александър Йорданов*

- [Kiks07](https://www.github.com/Kiks07Bg)
- [Kamen Zhekovski](https://www.github.com/KameZh)
- [Aleksandar Tachev](https://www.github.com/AleksTach)
- [Georgi Ivanov](https://www.github.com/Georgi-IV)

