import fetchData from './modules/data.js'
import setupSpikeVisualisation, {drawSpikeVis} from './modules/spikeVis.js'
import setupPongVisualisation, {drawPongVis} from './modules/pongVis.js'

const SAMPLE_RATE = 20000

const startVisualisation = async () => {
    const [replay, spikes] = await fetchData()

    const firstFrame = replay[0] < spikes[0] ? replay[0] : spikes[0]
    const lastFrame = replay[1] > spikes[1] ? replay[1] : spikes [1]

    let duration = Number(lastFrame - firstFrame) / SAMPLE_RATE
    setPlaybackTime(0, duration)

    window.isPlaying = false
    window.currentFrame = Number(firstFrame)

    document.getElementById("scrubber").oninput = (e) => {
        const playbackPercentage = e.target.value
        window.currentFrame = (Number(lastFrame - firstFrame) * (playbackPercentage / 1000)) + Number(firstFrame)
    }

    const spikeDecaySlider = document.getElementById("decay-slider")
    const spikeDecayLabel = document.getElementById("decay-label")

    window.spikeDecay = spikeDecaySlider.value
    spikeDecayLabel.innerHTML = `${window.spikeDecay} sec`
    
    spikeDecaySlider.onchange = (e) => {
        window.spikeDecay = spikeDecaySlider.value
        spikeDecayLabel.innerHTML = `${window.spikeDecay} sec`
    }

    const amplitudeSlider = document.getElementById("amplitude-slider")
    amplitudeSlider.max = spikes[2] * 10
    amplitudeSlider.value = spikes[2] / 2 * 10
    window.maxAmp = amplitudeSlider.value / 10

    const currentMaxAmp = document.getElementById("current-max-amp")
    currentMaxAmp.innerHTML = `${window.maxAmp.toFixed(1)}μV`

    amplitudeSlider.onchange = (e) => {
        window.maxAmp = amplitudeSlider.value / 10
        currentMaxAmp.innerHTML = `${window.maxAmp.toFixed(1)}μV`
    }

    const maxAmpLabel = document.getElementById("max-amp-label")
    maxAmpLabel.innerHTML = `${spikes[2].toFixed(1)}μV`

    const spikeVis = setupSpikeVisualisation()
    const pongVis = setupPongVisualisation()
    
    requestAnimationFrame((timestamp) => {
        renderLoop(timestamp, 0, firstFrame, lastFrame, spikeVis, spikes, pongVis, replay[2])
    })
}

function renderLoop(timestamp, lastTimestamp, startFrame, endFrame, spikeVis, spikes, pongVis, replay) {
    const timeDelta = (timestamp - lastTimestamp) / 1000

    const framesNeeded = timeDelta * SAMPLE_RATE // 320 frames ~ 0.016 sec

    if (window.isPlaying) {
        const lastFrame =  window.currentFrame
        const currentFrame = lastFrame + framesNeeded
        const spikesBuffer = spikes[3]
        const getElectrodeForChannel = spikes[4]

        if (currentFrame < endFrame) {
            
            // Pong Animation
            for (let index = 0; index < replay.length; index++) {

                if (Number(replay[index][0]) > lastFrame && 
                    Number(replay[index][0]) < currentFrame) {    
                        drawPongVis(pongVis, [replay[index][1], replay[index][2], replay[index][3]])
                        break
                }
                
            }

            // Spike Animation
            for (let index = 0; index < spikesBuffer.length; index++) {
                const frameNumber = spikesBuffer[index][0]

                if (frameNumber >= lastFrame && frameNumber < currentFrame) {
                    const spikes = spikesBuffer[index][1]
                    
                    spikes.forEach(spike => {
                        const amplitude = spike[1]
                        const electrode = getElectrodeForChannel(spike[0])

                        if (electrode !== undefined) {// Update SpikeVis Magnitude
                            spikeVis.attributes.magnitude.array[electrode] = 1.0

                            //Update SpikeVis Amplitude
                            let normalisedAmplitude = amplitude / (window.maxAmp * -1)

                            if (normalisedAmplitude <= 1.0) {
                                spikeVis.attributes.amplitude.array[electrode] = normalisedAmplitude
                            } else {
                                spikeVis.attributes.amplitude.array[electrode] = 1.0
                            } 
                        }
                    })
                }

                if (frameNumber >= currentFrame) {
                    break
                }
            }

            spikeVis.attributes.amplitude.needsUpdate = true
            spikeVis.attributes.magnitude.needsUpdate = true
        
            window.currentFrame = currentFrame
            
            let elapsedTime = (currentFrame - Number(startFrame)) / SAMPLE_RATE
            let duration = Number(endFrame - startFrame) / SAMPLE_RATE

            setPlaybackTime(elapsedTime, duration)
        } else {
            window.isPlaying = false
            document.getElementById("play-pause").src = "img/play.svg"
        }
        
        document.getElementById("scrubber").value = (window.currentFrame - Number(startFrame)) / Number(endFrame - startFrame) * 1000
    }

    window.onresize = (e) => {
        spikeVis.renderer.setPixelRatio(window.devicePixelRatio)
        spikeVis.renderer.setSize(window.innerWidth, window.innerHeight)
        spikeVis.cameraControls.camera.aspect = window.innerWidth / window.innerHeight
        spikeVis.cameraControls.camera.updateProjectionMatrix()
    }

    drawSpikeVis(spikeVis.renderer, spikeVis.scene, spikeVis.cameraControls, spikeVis.attributes)
    
    requestAnimationFrame((newTimestamp) => {
        renderLoop(newTimestamp, timestamp, startFrame, endFrame, spikeVis, spikes, pongVis, replay)
    })
}

function setPlaybackTime(elapsedTime, duration) {
    if (elapsedTime % 60 < 10) {
        elapsedTime = `${Math.floor(elapsedTime/60)}:0${Math.floor(elapsedTime%60)}`
    } else {
        elapsedTime = `${Math.floor(elapsedTime/60)}:${Math.floor(elapsedTime%60)}`
    }
    
    if (duration % 60 < 10) {
        duration = `${Math.floor(duration/60)}:0${Math.floor(duration%60)}`
    } else {
        duration = `${Math.floor(duration/60)}:${Math.floor(duration%60)}`
    }

    document.getElementById("playback-time").innerHTML = `${elapsedTime} / ${duration}`
}

document.getElementById("play-pause").onclick = (e) => {
    if (window.isPlaying) {
        window.isPlaying = false
        e.target.src = "img/play.svg"
    } else {
        window.isPlaying = true
        e.target.src = "img/pause.svg"
    }
}

window.onload = (e) => {
    startVisualisation()
    
    const panels = document.getElementsByClassName("panel")
    
    for (let panel of panels) {
        let header, panelHide, chevron

        for (let element of panel.children) {
            if (element.classList[0] === "header") {
                header = element
                for (let headerChild of header.children) {

                    if (headerChild.classList[0] === "chevron") {
                        chevron  = headerChild
                    }
                }
            }

            if (element.classList[0] === "mobile-hide") {
                panelHide = element

                if (window.innerWidth < 768) {
                    chevron.classList.add("down")
                    panelHide.classList.add("hide")
                } else {
                    chevron.classList.add("up")
                }
            }

            header.onclick = (e) => {
                if (panelHide.classList[1] === "hide") {
                    panelHide.classList.remove("hide")
                    chevron.classList.remove("down")
                    chevron.classList.add("up")
                } else {
                    panelHide.classList.add("hide")
                    chevron.classList.remove("up")
                    chevron.classList.add("down")
                }
            }
        }
    }
}