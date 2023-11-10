async function fetchData() {
    const replay = await fetch('http://localhost:8080/replay.bin')
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.arrayBuffer()
    })
    .catch(error => {
        console.error('There has been a problem with your fetch operation:', error);
    })

    const spikes = await fetch('http://localhost:8080/spikes.bin')
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.arrayBuffer()
    })
    .catch(error => {
        console.error('There has been a problem with your fetch operation:', error);
    })

    return [new DataView(replay), new DataView(spikes)]
}

async function boo() {
    const [replay, spikes] = await fetchData()
    const [firstReplayFrame, lastReplayFrame, replayArray] = parseReplay(replay)
    
    let start
    let lastTimestamp

    let frameIndex = 0

    function animatePong(timestamp) {
        if (start === undefined)
            start = timestamp
        
        const scaling = 230 / 600
        const elapsed = timestamp - start

        const canvas = document.getElementById('game-canvas');
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, 230, 230);

        if (elapsed === 0) {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 175 * scaling, 10 * scaling, 250 * scaling);
    
            ctx.fillStyle = 'white';
            ctx.arc(300 * scaling, 300 * scaling, 10 * scaling, 0.0, 2*Math.PI)
            ctx.fill()
        } else {
            const lastFrameNumber = replayArray[frameIndex][0]
            const framesDelta = ((timestamp - lastTimestamp)/1000) * 20000
            
            let batY
            let ballX
            let ballY

            for (let index = frameIndex; index < replayArray.length; index++) {
                batY = replayArray[index][1]
                ballX = replayArray[index][2]
                ballY = replayArray[index][3]

                frameIndex = index + 1
                
                if ((Number(lastFrameNumber) + framesDelta) > Number(replayArray[index][0])) {
                    break
                }
            }
            
            ctx.fillStyle = 'white';
            ctx.fillRect(0, batY * scaling, 10 * scaling, 250 * scaling);

            ctx.beginPath()
            ctx.arc(ballX * scaling, ballY * scaling, 10 * scaling, 0.0, 2*Math.PI)
            ctx.closePath()
            ctx.fillStyle = 'white'
            ctx.fill()
        }

        lastTimestamp = timestamp

        window.requestAnimationFrame(animatePong)
    }

    window.requestAnimationFrame(animatePong)
}

function parseReplay(replay) {
    let firstFrameNumber, lastFrameNumber
    let replayArray = []

    for (let index = 40; index < replay.byteLength; index+=40) {
        const frameNumber = replay.getBigUint64(index, true)

        if (index === 40) {
            firstFrameNumber = frameNumber
        }

        const batY = replay.getFloat32(index+8, true)
        const ballX = replay.getFloat32(index+12, true)
        const ballY = replay.getFloat32(index+16, true)

        replayArray.push([frameNumber, batY, ballX, ballY])
    }
    
    return [firstFrameNumber, lastFrameNumber, replayArray]
}

