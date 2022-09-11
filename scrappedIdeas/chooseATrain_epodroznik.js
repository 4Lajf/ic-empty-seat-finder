const puppeteer = require('puppeteer');
const readline = require('readline');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }))
}

(async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto('https://www.e-podroznik.pl/');
    let dateNow = Date.now()
    await page.click('.ep-ok-btn.icon.icon-arrow-right.icon-right')

    await page.type('.lblFrom.balloon-hint.bottom-center', 'Poznań Główny')
    await page.waitForSelector('.ac_over')
    await page.click('.ac_over')

    await page.type('.lblTo.balloon-hint.bottom-center', 'Szczecinek')
    await page.waitForSelector('.ac_over')
    await page.click('.ac_over')

    await page.click('.fldText.fldDateV-caption')

    /*     const grabDate = await page.evaluate(async () => {
            let calendarDate = []
            const calContent = document.querySelectorAll('.jCalendar')
            const calendar = calContent[0].querySelectorAll('tbody')
            console.log(calendar)
            const calendarWeeks = calendar[0].querySelectorAll('tr')
            console.log(calendarWeeks)
            const calendarWeek4 = calendarWeeks[3].querySelectorAll('td')
            console.log(calendarWeek4)
            const calendarDay25 = calendarWeek4[6].querySelectorAll('span')
            console.log(calendarDay25)
            for (const day of calendarDay25) {
                calendarDate.push(day)
            }
            console.log(calendarDate[0])
            return calendarDate[0]
        })
    */

    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await page.waitForSelector('.searching-results-list')
    await page.click('.carrierTypesSelect.selectAlike')
    await page.click('.lblCarrierType.labelCheckbox.carrierType-bus.firstOption')
    await page.click('.lblCarrierType.labelCheckbox.carrierType-aut')
    await page.click('.lblCarrierType.labelCheckbox.carrierType-city')
    await page.click('.lblCarrierType.labelCheckbox.carrierType-ferry.lastOption')
    await page.keyboard.press('Enter');
    await page.waitForSelector('.searching-results-list')
    await sleep(4000)
    await page.click('.icon.icon-right.icon-arrow-down.button-secondary.btnExtendResults.btnSearchForLater')
    await page.waitForSelector('.searching-results-list')
    await sleep(4000)
    await page.click('.icon.icon-right.icon-arrow-down.button-secondary.btnExtendResults.btnSearchForLater')
    await page.waitForSelector('.searching-results-list')
    await sleep(4000)
    await page.click('.icon.icon-right.icon-arrow-down.button-secondary.btnExtendResults.btnSearchForLater')
    await page.waitForSelector('.searching-results-list')

    const grabConnections = await page.evaluate(() => {
        const resultsList = document.querySelectorAll('.searching-results-list')
        const connections = resultsList[0].querySelectorAll('div[class="searching-result"]')
        let connectionsArr = []
        let trainToClick
        connections.forEach((connection) => {
            const connectionInfo = connection.querySelector('.brief-info.sticks-1')

            const departureNesting1 = connectionInfo.querySelector('.edges-info')
            const departureNesting2 = departureNesting1.querySelector('.edge-date-time')
            const departureNesting3 = departureNesting2.querySelector('.departure')
            const departureTime = departureNesting3.querySelector('.time')
            const departureDate = departureNesting3.querySelector('.date')

            const arrivalNesting1 = connectionInfo.querySelector('.edges-info')
            const arrivalNesting2 = arrivalNesting1.querySelector('.edge-date-time')
            const arrivalNesting3 = arrivalNesting2.querySelector('.departure')
            const arrivalTime = arrivalNesting3.querySelector('.time')
            const arrivalDate = arrivalNesting3.querySelector('.date')

            const brandNesting1 = connectionInfo.querySelector('.travel-parts')
            const brandNesting2 = brandNesting1.querySelector('div[class="travel-part"]')
            const trainNumber = brandNesting2.querySelector('span')
            connectionsArr.push({
                departureTime: departureTime.innerText,
                departureDate: departureDate.innerText,
                arrivalTime: arrivalTime.innerText,
                arrivalDate: arrivalDate.innerText,
                trainBrand: trainNumber.innerText
            })
            trainToClick = brandNesting2
        })
        return [{ connectionsArr: connectionsArr, trainToClick: trainToClick }]
    })
    console.log(grabConnections.connectionsArr, grabConnections.trainToClick)
    let connectionsArr = grabConnections.connectionsArr
    let trainToClick = grabConnections.trainToClick
    let avaliableTrains = `
===================================================================
Wprowadź liczbę od 1 do ${connectionsArr.length} aby wybrać pociąg
===================================================================`
    for (let i = 0; i < connectionsArr.length; i++) {
        avaliableTrains += `
${i + 1}. -------------------------------
Odjazd: ${connectionsArr[i].departureTime} (${connectionsArr[i].departureDate})
Przyjazd: ${connectionsArr[i].arrivalTime} (${connectionsArr[i].arrivalDate})
Pociąg: ${connectionsArr[i].trainBrand}8`
    }
    console.log(avaliableTrains)
    const train = await askQuestion("")
    const answer = connectionsArr[train - 1].trainBrand
    console.log('answer:', connectionsArr[train - 1].trainBrand)


    /* await browser.close(); */
})();