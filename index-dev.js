let destFrom = 'Poznań Główny',
    destTo = 'Szczecinek',
    date = '12.09',
    hour = '17',
    minute = '30';

import puppeteer from 'puppeteer-extra'
import Timeout from 'await-timeout'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker'
puppeteer.use(StealthPlugin())
puppeteer.use(AdblockerPlugin({ blockTrackers: true }))
let isNextIteration = false, loops = 0, debug = false;
let finalSeats = [], seatFinder = null, page, timer, timeouts = 2;


/* process.on('unhandledRejection', reason => {
    console.log(`An exception has occured.\n${reason}
    Huh, to się nie powinno zdarzyć. A jednak skoro to widzisz to znaczy, że się zdarzyło. Odśwież stronę i spróbuj ponownie, to powinno pomóc. Mam nadzieję...`)
    process.exit()
}); */

function sleep(milliseconds) {
    const date = Date.now();
    let currentDate = null;
    do {
        currentDate = Date.now();
    } while (currentDate - date < milliseconds);
}

(async () => {
    let today = new Date();
    let timeHours = today.getHours()
    let timeMinutes = today.getMinutes()
    let dateDay = today.getDay()

    /* //First day of each month IC has service time from 23:45 to 1:00
    if (dateDay === 1) {
        if (timeHours === 23 && timeMinutes >= 45 <= 60) {
            console.log("Trwa przerwa techniczna w systemie PKP Intercity. Sprawdzenie miejsc będzie możliwe dopiero po godzinie 1:00")
            return;
        }
        if (timeHours === 0 && timeMinutes >= 0 <= 59) {
            console.log("Trwa przerwa techniczna w systemie PKP Intercity. Sprawdzenie miejsc będzie możliwe dopiero po godzinie 1:00")
            return;
        }
    
        if (timeHours === 1 && timeMinutes === 0) {
            console.log("Trwa przerwa techniczna w systemie PKP Intercity. Sprawdzenie miejsc będzie możliwe dopiero po godzinie 1:00")
            return;
        }
    }
    
    //Every other day IC has service time from 23:45 to 0:30
    if (dateDay !== 1) {
        if (timeHours === 23 && timeMinutes >= 45 && timeMinutes <= 60) {
            console.log("Trwa przerwa techniczna w systemie PKP Intercity. Sprawdzenie miejsc będzie możliwe dopiero po godzinie 0:30")
            return;
        }
        if (timeHours === 0 && timeMinutes >= 0 && timeMinutes <= 30) {
            console.log("Trwa przerwa techniczna w systemie PKP Intercity. Sprawdzenie miejsc będzie możliwe dopiero po godzinie 0:30")
            return;
        }
    } */


    const reRun = async (destFrom, destTo, daysDiference, hour, minute) => {
        seatFinder = null;
        if (page) {
            await page.close()
        }

        timer = new Timeout();
        try {
            await Promise.race([
                seatFinder = searchForSeats(destFrom, destTo, daysDiference, hour, minute, true),
                timer.set(30000, 'Timeout')
            ]);
        } catch (error) {
            timeouts++
            if (timeouts > 3) {
                console.log('Wyszukiwanie nieudane po 3 próbach. Spróbuj ponownie za jakiś czas.')
                await browser.close();
                return;
            }
            console.log(`Wyszukiwanie wyczerpało limit czasu. Ponawiam... [${timeouts}/3]`);
            await reRun(destFrom, destTo, date, hour, minute, debug)
        } finally {
            timer.clear();
            timer = null
        }
    }

    const browser = await puppeteer.launch({ headless: true })
    const searchForSeats = async (DEST_FROM, DEST_TO, DATE, HOUR_DATA, MINUTE_DATA, DEBUG) => {
        page = await browser.newPage()
        await page.setViewport({ width: 800, height: 600 })
        await page.goto('https://bilkom.pl/')
        sleep(1500)
        await page.waitForSelector('.form-control.typeahead.tt-input')
        if (!isNextIteration) {
            await page.click('.form-control.typeahead.tt-input')
        }
        console.log('Wprowadzam dane podróży...')

        await page.type('input[name="fromStation"]', DEST_FROM)
        await page.waitForSelector('.tt-menu.tt-open')
        sleep(400)
        await page.click('.tt-station.tt-suggestion.tt-selectable')

        await page.type('input[name="toStation"]', DEST_TO)
        await page.waitForSelector('.tt-menu.tt-open')
        sleep(400)
        await page.evaluate((btnSelector) => {
            // this executes in the page
            document.querySelector(btnSelector).click();
        }, '.tt-station.tt-suggestion.tt-selectable');

        await page.keyboard.press('Tab');
        await page.waitForSelector('input[name="date"]')
        await page.click('input[name="date"]')
        await page.click(`td[data-day="${DATE}.2022"]`)

        await page.waitForSelector('.timepicker-hour')
        await page.click('.timepicker-hour')
        await page.evaluate(async (HOUR_DATA) => {
            const hoursContainer = document.querySelector('.timepicker-hours')
            const hours = hoursContainer.querySelectorAll('.hour')
            let HTMLHour = []
            for (const hour of hours) {
                HTMLHour.push(hour)
            }
            HTMLHour.forEach((hour) => {
                if (hour.innerText === HOUR_DATA) {
                    hour.click()
                } else { return; }
            })
        }, HOUR_DATA)

        await page.click('.timepicker-minute')
        await page.evaluate(async (MINUTE_DATA) => {
            const minutesContainer = document.querySelector('.timepicker-minutes')
            const minutes = minutesContainer.querySelectorAll('.minute')
            let HTMLMinute = []
            for (const minute of minutes) {
                HTMLMinute.push(minute)
            }
            HTMLMinute.forEach((minute) => {
                if (minute.innerText === MINUTE_DATA) {
                    minute.click()
                } else { return; }
            })
        }, MINUTE_DATA)

        await page.click('#search-btn')
        console.log('Wysukuje połączenia...')

        let trainRoute
        console.log('Pobieram dane pierwszego pociągu...')

        if (!isNextIteration) {
            await page.waitForSelector('#main-content')
            sleep(1000)
            const trainNumber = await page.evaluate(() => {
                return document.querySelector('.hidden.main-carrier').innerText
            });
            console.log(trainNumber)
            try {
                if (!/IC ....[0-9]/g.test(trainNumber)) {
                    console.log(5)
                    throw { name: 'InvalidTrainType', desc: 'Wybrany pociąg nie jest pociągiem PKP Intercity', fatal: true }
                }
            } catch (error) {
                console.error(error.desc)
                await browser.close();
                return;
            }
            await page.click('.el')
            sleep(500)
            console.log('Pobieram trasę pociągu...')
            const getTrainRoute = await page.evaluate(async () => {
                let rawStations = document.querySelectorAll('.stations-map')
                let trainStations = [], toDel
                rawStations = rawStations[0].innerText.match(/([^\r\n])[^\r\n]*[\r\n]*/gi)
                for (let i = 0; i < rawStations.length - 3; i++) {
                    console.log(i, rawStations[i], rawStations.length)
                    if (i % 2 !== 0 && i !== 1 && i !== rawStations.length - 1) {
                        toDel = rawStations[i].match(/.\b(\w+)\W*$/gi)[0]
                        rawStations[i] = rawStations[i].replace(toDel, '')
                        trainStations.push(rawStations[i])
                    }
                }
                return trainStations
            })
            trainRoute = getTrainRoute
            console.log(trainRoute)
        }
        await page.waitForSelector('.buy-tickets-btn')
        await page.evaluate((btnSelector) => {
            // this executes in the page
            document.querySelector(btnSelector).click();
        }, '.call-action');

        if (isNextIteration) {
            await page.waitForSelector('#new-order')
            await page.evaluate((btnSelector) => {
                document.querySelector(btnSelector).click();
            }, '#new-order');
        }

        console.log('Sprawdzam dostępność miejsc...')
        await page.waitForSelector('#go-to-summary')
        await page.click('#go-to-summary')

        await page.waitForSelector('input[placeholder="Imię..."]')
        await page.type('input[placeholder="Imię..."]', 'Jan')
        await page.type('input[placeholder="Nazwisko..."]', 'Kowalski')
        await page.type('input[placeholder="E-Mail..."]', 'jebac@pis.com')
        await page.type('input[placeholder="Powtórz E-Mail..."]', 'jebac@pis.com')
        await page.click('#go-to-summary')
        await page.waitForSelector('.form-content-wrapper')

        const seatInfo = await page.evaluate((DEBUG) => {
            const fullInfo = document.querySelector('.text-indent').innerText.replace(/\s+/g, ' ').trim()
            console.log(fullInfo)

            const trainClass = fullInfo.match(/klasa../g)[0]
            const trainCoach = fullInfo.match(/wagon../g)[0] //trim whitespace
            const trainSeat = fullInfo.match(/miejsca: ../g)[0] //trim whitespace
            console.log(trainClass, trainCoach, trainSeat)
            /* DEBUG */
            if (DEBUG === true) {
                return {
                    trainClass: '2 klasa',
                    trainCoach: 'brak gwarancji',
                    trainSeat: 'brak gwarancji'
                }
            }
            /* END */
            return {
                trainClass: trainClass,
                trainCoach: trainCoach,
                trainSeat: trainSeat
            }
        }, DEBUG)
        isNextIteration = true;
        console.log({ seatInfo: seatInfo, trainRoute: trainRoute })
        return { seatInfo: seatInfo, trainRoute: trainRoute }
    }
    page = null
    timer = new Timeout();

    try {
        await Promise.race([
            seatFinder = searchForSeats(destFrom, destTo, date, hour, minute, true),
            timer.set(30000, 'Timeout')
        ]);
    } catch (error) {
        timeouts++
        if (timeouts > 3) {
            console.log('Wyszukiwanie nieudane po 3 próbach. Spróbuj ponownie za jakiś czas.')
            await browser.close();
            return;
        }
        console.log(`Wyszukiwanie wyczerpało limit czasu. Ponawiam... [${timeouts}/3]`);
        await reRun(destFrom, destTo, date, hour, minute, debug)
    } finally {
        if (timer) {
            timer.clear();
            timer = null
        }
    }

    await page.close()
    if (!seatFinder) { return; }

    let seatInfo = seatFinder.seatInfo,
        trainRoute = seatFinder.trainRoute,
        trainCoach = seatInfo.trainCoach, trainSeat = seatInfo.trainSeat, trainClass = seatInfo.trainClass;
    if (trainCoach !== 'brak gwarancji' || trainSeat !== 'brak gwarancji') {
        finalSeats.push({ trainCoach: trainCoach, trainSeat: trainSeat, trainClass: trainClass, destFrom: destFrom, destTo: destTo })
    }

    console.log(`
==============================
${destFrom} -> ${destTo}
${trainCoach} | ${trainSeat} | ${trainClass}
==============================
`)

    while (destTo !== destFrom) {
        loops = 0
        while (trainCoach === 'brak gwarancji' || trainSeat === 'brak gwarancji') {
            destTo = trainRoute[trainRoute.length - loops - 1]
            loops++
            /* DEBUG */
            if (loops >= 2) {
                debug = false
            } else {
                debug = true
            }
            /* END */
            page = null

            timer = new Timeout();
            try {
                await Promise.race([
                    seatFinder = searchForSeats(destFrom, destTo, date, hour, minute, true),
                    timer.set(30000, 'Timeout')
                ]);
            } catch (error) {
                timeouts++
                if (timeouts > 3) {
                    console.log('Wyszukiwanie nieudane po 3 próbach. Spróbuj ponownie za jakiś czas.')
                    await browser.close();
                    return;
                }
                console.log(`Wyszukiwanie wyczerpało limit czasu. Ponawiam... [${timeouts}/3]`);
                await reRun(destFrom, destTo, date, hour, minute, debug)
            } finally {
                timer.clear();
                timer = null
            }

            await page.close()
            if (!seatFinder) { return; }
            let seatInfo = seatFinder.seatInfo,
                trainCoach = seatInfo.trainCoach, trainSeat = seatInfo.trainSeat, trainClass = seatInfo.trainClass;
            if (trainCoach !== 'brak gwarancji' || trainSeat !== 'brak gwarancji') {
                finalSeats.push({ trainCoach: trainCoach, trainSeat: trainSeat, trainClass: trainClass, destFrom: destFrom, destTo: destTo })
            }

            console.log(`
==============================
${destFrom} -> ${destTo}
${trainCoach} | ${trainSeat} | ${trainClass}
==============================
`
            )
        }
        destFrom = destTo
        destTo = trainRoute[trainRoute.length]
    }

    console.log(`\n##############################`)
    finalSeats.forEach(seat => {
        console.log(`${seat.destFrom} -> ${seat.destTo}
${seat.trainCoach} | ${seat.trainSeat} | ${seat.trainClass}`)
    });
    console.log(`##############################\n`)

    await browser.close();
})();
