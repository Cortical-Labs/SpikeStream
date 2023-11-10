function getUint64(dataview, byteOffset, littleEndian) {
    // split 64-bit number into two 32-bit (4-byte) parts
    const left = dataview.getUint32(byteOffset, littleEndian);
    const right = dataview.getUint32(byteOffset + 4, littleEndian);

    // combine the two 32-bit values
    const combined = littleEndian ? left + 2 ** 32 * right : 2 ** 32 * left + right;

    if (!Number.isSafeInteger(combined))
        console.warn(combined, 'exceeds MAX_SAFE_INTEGER. Precision may be lost');

    return combined;
}

async function fetchWithProgress(url) {
    const response = await fetch(url)

    const length = response.headers.get('Content-Length')
    const buffer = new ArrayBuffer(length)
    const array = new Uint8Array(buffer)
    let at = 0
    const reader = response.body.getReader()

    for (; ;) {
        const { done, value } = await reader.read();
        if (done) {
            break
        }
        array.set(value, at)
        at += value.length
        console.log(`${at} / ${length}`)
    }

    return buffer
}

async function fetchData() {
    const replaySize = await fetch(`http://${window.location.host}/replay.bin`, {method: 'HEAD'})
                        .then(response => parseInt(response.headers.get('Content-Length')))
    const spikesSize = await fetch(`http://${window.location.host}/spikes.bin`,{method: 'HEAD'})
                        .then(response =>  parseInt(response.headers.get('Content-Length')))
    
    console.log(replaySize + spikesSize)
    const replayData = await fetchWithProgress(`http://${window.location.host}/replay.bin`)
    const spikesData = await fetchWithProgress(`http://${window.location.host}/spikes.bin`)

    const cfgData = await fetch(`http://${window.location.host}/gen3b.cfg`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.text()
        }).catch(error => {
            console.error('There has been a problem with your fetch operation:', error);
        })

    const electrodeChannelsMap = parseConfig(cfgData)
    const getElectrodeForChannel = (channel) => {
        const elch = electrodeChannelsMap.find((elch) => elch[0] == channel)
        if (elch !== undefined) {
            return elch[1]
        } else {
            return undefined
        }
    }

    const replay = parseReplay(new DataView(replayData))
    //const spikes = parseSpikes(new DataView(spikesData))
    const spikes = parseSpikes(new DataView(spikesData))
    spikes[4] = getElectrodeForChannel

    return [replay, spikes]
}


function parseConfig(cfg) {
    let electrodeChannelsMap = []

    const electrodeChannels = cfg.split("\n")[0].split(";")

    electrodeChannels.forEach(element => {
        if (element.length > 0) {
            const channel = element.split("(")[0]
            const electrode = element.match(/\((.*?)\)/)[1]
            electrodeChannelsMap.push([channel, electrode])
        }
    })

    return electrodeChannelsMap
}

function parseReplay(replay) {
    let firstFrameNumber, lastFrameNumber
    let replayArray = []

    for (let index = 40; index < replay.byteLength; index += 40) {
        const frameNumber = getUint64(replay, index, true)

        if (index === 40) {
            firstFrameNumber = frameNumber
        }

        const batY = replay.getFloat32(index + 8, true)
        const ballX = replay.getFloat32(index + 12, true)
        const ballY = replay.getFloat32(index + 16, true)

        replayArray.push([frameNumber, batY, ballX, ballY])
        lastFrameNumber = frameNumber
    }

    return [firstFrameNumber, lastFrameNumber, replayArray]
}

function parseSpikes(spikes) {
    let firstFrameNumber, lastFrameNumber, maxAmplitude
    let spikesArray = []

    let accumulator = 0;
    let spikeCount = 0;

    for (let index = 0; index < spikes.byteLength; index += 16) {
        const frameNumber = getUint64(spikes, index, true)

        const channel = spikes.getUint32(index + 8, true)
        const amplitude = spikes.getFloat32(index + 12, true)

        accumulator += amplitude

        if (index === 0) {
            firstFrameNumber = frameNumber
            spikesArray.push([frameNumber, [[channel, amplitude]]])
        } else {
            if (frameNumber === lastFrameNumber) {
                const frameSpike = spikesArray.slice(-1)[0]
                frameSpike[1].push([channel, amplitude])
            } else {
                spikesArray.push([frameNumber, [[channel, amplitude]]])
            }
        }

        lastFrameNumber = frameNumber
        spikeCount++
    }

    const mean = accumulator / spikeCount

    accumulator = 0
    for (let index = 0; index < spikes.byteLength; index += 16) {
        const amplitude = spikes.getFloat32(index + 12, true)
        accumulator += Math.pow((amplitude - mean), 2)
    }

    const variance = accumulator / spikeCount
    console.log(`mu - ${mean}, sigma - ${Math.sqrt(variance)}`)

    maxAmplitude = Math.abs(mean) + Math.sqrt(variance) * 2

    return [firstFrameNumber, lastFrameNumber, maxAmplitude, spikesArray]
}


export default fetchData