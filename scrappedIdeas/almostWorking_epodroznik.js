const puppeteer = require('puppeteer');
const { setTimeout } = require('timers/promises');
const Timeout = require('await-timeout')

let cookiesAccepted = false, isNextIteration = false, destFrom, destTo, date, daysDiference, hour, minute, loops = 0, debug = false;
let finalSeats = [], seatFinder = null, page;
let searchTimeoutTries = 0, filterTimeoutTries = 0, searchSeatTimeout = 0, timeoutTime = 20000;
destFrom = 'Poznań Główny'
destTo = 'Szczecinek'
date = '09/09' /* month / day */
hour = '17'
minute = '30'
/* process.on('unhandledRejection', reason => {
    console.log(`An exception has occured.\n${reason}
    Huh, to się nie powinno zdarzyć. A jednak skoro to widzisz to znaczy, że się zdarzyło. Odśwież stronę i spróbuj ponownie, to powinno pomóc. Mam nadzieję...`)
    process.exit()
}); */

const calculateDate = (targetDate) => {
    let today = new Date();
    let dd = String(today.getDate()).padStart(2, '0');
    let mm = String(today.getMonth() + 1).padStart(2, '0');
    today = `${mm}/${dd}`

    let date1 = new Date(`${today}/2022`);
    let date2 = new Date(`${targetDate}/2022`);
    let Difference_In_Time = date2.getTime() - date1.getTime();
    let Difference_In_Days = Difference_In_Time / (1000 * 3600 * 24);
    return Difference_In_Days
}
daysDiference = calculateDate(date)

function sleep(milliseconds) {
    const date = Date.now();
    let currentDate = null;
    do {
        currentDate = Date.now();
    } while (currentDate - date < milliseconds);
}

function asyncSleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let today = new Date();
let timeHours = today.getHours()
let timeMinutes = today.getMinutes()
let dateDay = today.getDay()

//First day of each month IC has service time from 23:45 to 1:00
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
}

(async () => {
    const reRun = async (destFrom, destTo, daysDiference, hour, minute) => {
        seatFinder = null;
        if (page) {
            await page.close()
        }
        seatFinder = await searchForSeats(destFrom, destTo, daysDiference, hour, minute, true)
    }

    const browser = await puppeteer.launch({ headless: false })
    const searchForSeats = async (DEST_FROM, DEST_TO, DAYS_DIFERENCE, HOUR_DATA, MINUTE_DATA, DEBUG) => {
        page = await browser.newPage()
        await page.goto('https://www.e-podroznik.pl/')
        if (!cookiesAccepted) {
            await page.waitForSelector('.ep-ok-btn.icon.icon-arrow-right.icon-right')
            await page.click('.ep-ok-btn.icon.icon-arrow-right.icon-right')
        }
        cookiesAccepted = true
        await page.waitForSelector('.lblFrom.balloon-hint.bottom-center')
        console.log('Wprowadzam dane podróży...')
        await page.type('.lblFrom.balloon-hint.bottom-center', DEST_FROM)
        await page.waitForSelector('.ac_over')
        await page.click('.ac_over')

        await page.type('.lblTo.balloon-hint.bottom-center', DEST_TO)
        await page.waitForSelector('.ac_over')
        await page.click('.ac_over')

        await page.click('.fldText.fldDateV-caption')

        for (let i = 0; i < DAYS_DIFERENCE; i++) {
            await page.keyboard.press('ArrowUp');
        }
        await page.click('.fldText.fldTimeV-caption')
        const grabHour = await page.evaluate(async (HOUR_DATA) => {
            const hoursContainer = document.querySelector('.frmToolbar.tcHoursContainer')
            const hours = hoursContainer.querySelectorAll('.frmButton.btnHour')
            let HTMLHour = []
            for (const hour of hours) {
                HTMLHour.push(hour)
            }
            HTMLHour.forEach((hour) => {
                console.log(hour.innerText)
                if (hour.innerText === HOUR_DATA) {
                    hour.click()
                } else { return; }
            })
        }, HOUR_DATA)

        const grabMinute = await page.evaluate(async (MINUTE_DATA) => {
            const minutesContainer = document.querySelector('.frmToolbar.tcMinutesContainer')
            const minutes = minutesContainer.querySelectorAll('.frmButton.btnMinute')
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

        await page.click('.btnSubmit.btnSearch.icon.icon-right.icon-loop')

        console.log('Czekam do 20 sekund na wyszukanie połączeń...')
        const searchTimer = new Timeout();
        try {
            await Promise.race([
                page.waitForSelector('.searching-results-list'),
                searchTimer.set(timeoutTime, 'Search Timeout')
            ]);
        } catch (error) {
            searchTimeoutTries++
            if (searchTimeoutTries > 3) {
                console.log('Wyszukiwanie nieudane po 3 próbach. Spróbuj ponownie za jakiś czas.')
                await browser.close();
                return;
            }
            console.log(`Wyszukiwanie wyczerpało limit czasu. Ponawiam... [${searchTimeoutTries}/3]`);
            await reRun(DEST_FROM, DEST_TO, DAYS_DIFERENCE, HOUR_DATA, MINUTE_DATA)
        } finally {
            searchTimer.clear();
        }

        await page.click('.carrierTypesSelect.selectAlike')
        await page.click('.icon.icon-left.icon-carrierType-BUS')
        await page.click('.icon.icon-left.icon-carrierType-AUT')
        await page.click('.icon.icon-left.icon-carrierType-CITY')
        await page.click('.icon.icon-left.icon-carrierType-FERRY')
        await page.keyboard.press('Enter');

        console.log('Czekam do 20 sekund na wynik filtrowania połączeń...');
        const filterTimer = new Timeout();
        try {
            await Promise.race([
                page.waitForSelector('.searching-results-list'),
                filterTimer.set(timeoutTime, 'Filter Timeout')
            ]);
        } catch (error) {
            filterTimeoutTries++
            if (filterTimeoutTries > 3) {
                console.log('Wyszukiwanie nieudane po 3 próbach. Spróbuj ponownie za jakiś czas.')
                await browser.close();
                return;
            }
            console.log(`Wyszukiwanie wyczerpało limit czasu. Ponawiam... [${filterTimeoutTries}/3]`);
            await reRun(DEST_FROM, DEST_TO, DAYS_DIFERENCE, HOUR_DATA, MINUTE_DATA)
        } finally {
            filterTimer.clear();
        }

        let trainRoute
        console.log('Pobieram dane pierwszego pociągu...')


        if (!isNextIteration) {
            const grabTrainNumbers = await page.evaluate(() => {
                function sleep(milliseconds) {
                    const date = Date.now();
                    let currentDate = null;
                    do {
                        currentDate = Date.now();
                    } while (currentDate - date < milliseconds);
                }


                const resultsList = document.querySelectorAll('.searching-results-list')
                const connections = resultsList[0].querySelectorAll('.searching-result')
                let trainNumbers = []
                connections.forEach((connection) => {
                    const connectionInfo = connection.querySelector('.brief-info.sticks-1')
                    if (!connectionInfo) { return; }
                    const brandNesting1 = connectionInfo.querySelector('.travel-parts')
                    const brandNesting2 = brandNesting1.querySelector('div[class="travel-part"]')
                    const trainNumber = brandNesting2.querySelector('span')
                    trainNumbers.push(trainNumber.innerText)
                })
                return trainNumbers
            })

            try {
                if (!/.[IC] ....[0-9]/g.test(grabTrainNumbers[0])) {
                    throw { name: 'InvalidTrainType', desc: 'Wybrany pociąg nie jest pociągiem PKP Intercity', fatal: true }
                }
            } catch (error) {
                console.error(error.desc)
                await browser.close();
                return;
            }

            await page.click('.brief-info.sticks-1')
            await page.waitForSelector('.icon.icon-right.icon-arrow-right.colorStick1.lnkShowIntermediateStops')
            await page.click('.icon.icon-right.icon-arrow-right.colorStick1.lnkShowIntermediateStops')
            console.log('Pobieram trasę pociągu...')
            const getTrainRoute = await page.evaluate(async () => {
                function sleep(ms) {
                    return new Promise(resolve => setTimeout(resolve, ms));
                }

                const resultsContainer = document.querySelector('.stops-list')
                await sleep(1000)
                const stopsList = resultsContainer.querySelectorAll('.stop-item')
                let stopsArr = []
                stopsList.forEach((stop) => {
                    const stopInfo = stop.querySelector('.route-details')
                    const stopName = stopInfo.querySelector('.stop-name')
                    stopsArr.push(stopName.innerText)
                })
                return stopsArr
            })
            trainRoute = getTrainRoute
            console.log(trainRoute)
        }
        console.log('Sprawdzam dostępność miejsc...')
        await page.waitForSelector('.btnBuyTicket.btnSubmit.button-arrow-right')
        await page.click('.btnBuyTicket.btnSubmit.button-arrow-right')
        const searchSeats = new Timeout();
        try {
            await Promise.race([
                page.waitForSelector(`.nextStepButton.balloon-hint.bottom-center`),
                searchSeats.set(timeoutTime, 'Search Seats Timeout')
            ]);
        } catch (error) {
            searchSeatTimeout++
            if (searchSeatTimeout > 3) {
                console.log('Wyszukiwanie nieudane po 3 próbach. Spróbuj ponownie za jakiś czas.')
                await browser.close();
                return;
            }
            console.log(`Wyszukiwanie wyczerpało limit czasu. Ponawiam... [${searchSeatTimeout}/3]`);
            await reRun(DEST_FROM, DEST_TO, DAYS_DIFERENCE, HOUR_DATA, MINUTE_DATA)
        } finally {
            searchSeats.clear();
        }

        await page.waitForTimeout(4000)
        await page.click('.nextStepButton.balloon-hint.bottom-center')
        await page.waitForSelector(`.text.holderFName`)
        await page.type('.text.holderFName', 'Jan')
        await page.type('.text.holderSName', 'Kowalski')
        await page.type('input[name="formCompositeHolderForTicketH.email"]', 'jebac@pis.com')
        await page.type('input[name="formCompositeHolderForTicketH.reEmail"]', 'jebac@pis.com')

        await page.evaluate(() => {
            const rulesContainer = document.querySelector('.pagePartContainer.rulesAcceptance.greyArea.overflowAuto')
            const rules = rulesContainer.querySelectorAll('.confirmItem.confirmRules')
            let HTMLRules = []
            let toPush
            for (const rule of rules) {
                toPush = rule.querySelector('.labelBigCheckbox.lblCheckbox.lblConfirmRules')
                HTMLRules.push(toPush)
            }
            HTMLRules.forEach((rule) => {
                rule.click()
            })
        })
        await page.click('.nextStepButton.balloon-hint.bottom-center')
        await page.waitForSelector('.lblSeatInfoTrainClass')

        const seatInfo = await page.evaluate((DEBUG) => {
            const trainClass = document.querySelector('.lblSeatInfoTrainClass')
            const trainCoach = document.querySelector('.lblSeatInfoCoachNumber')
            const trainSeat = document.querySelector('.lblSeatInfoSeatNumber')

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
                trainClass: trainClass.innerText,
                trainCoach: trainCoach.innerText,
                trainSeat: trainSeat.innerText
            }
        }, DEBUG)
        isNextIteration = true;
        return { seatInfo: seatInfo, trainRoute: trainRoute }
    }
    page = null
    seatFinder = await searchForSeats(destFrom, destTo, daysDiference, hour, minute, true)
    await page.close()
    if (!seatFinder) { return; }

    let seatInfo = seatFinder.seatInfo,
        trainRoute = seatFinder.trainRoute,
        trainCoach = seatInfo.trainCoach, trainSeat = seatInfo.trainSeat, trainClass = seatInfo.trainClass;


    trainCoach = 'brak gwarancji'
    trainSeat = 'brak gwarancji'

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
            seatFinder = await searchForSeats(destFrom, destTo, daysDiference, hour, minute, debug)
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

    console.log(`\n******************************`)

    finalSeats.forEach(seat => {
        console.log(`
${seat.destFrom} -> ${seat.destTo}
${seat.trainCoach} | ${seat.trainSeat} | ${seat.trainClass}`)
    });
    console.log(`******************************\n`)

    await browser.close();
})();