function setupRenderer() {
    const renderer = new THREE.WebGLRenderer({
        antialias: true,
    })

    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(window.innerWidth, window.innerHeight)
    document.body.appendChild(renderer.domElement)
    
    return renderer
}

function setupCamera(renderer) {
    let camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 1, 1000)
    let controls = new THREE.OrbitControls(camera, renderer.domElement)

    camera.position.set(-50, -30, 0)
    controls.minDistance = 10
    controls.maxDistance = 800
    controls.maxPolarAngle = Math.PI / 2.5
    controls.update()

    return { camera, controls }
}

function setupGeometry() {
    let boxGeometry = new THREE.BoxBufferGeometry(0.8, 0.1, 0.8)
    let geometry = new THREE.InstancedBufferGeometry()
    let tileCount = 26400

    geometry.copy(boxGeometry)
    geometry.maxInstancedCount = tileCount

    let offsets = []
    let pickingColors = []

    let index = 0
    let magnitude = []
    let amplitude = []

    for (let j = 60; j > -60; j--) {
        for (let i = -110; i < 110; i++) {
            offsets.push(j, 0, i)
            amplitude.push(0.0)
            magnitude.push(-1.0)

            let color = new THREE.Color()
            color.setHex(index + 1)
            pickingColors.push(color.r, color.g, color.b)

            index++
        }
    }

    let magnitudeAttribute = new THREE.InstancedBufferAttribute(new Float32Array(magnitude), 1)
    let amplitudeAttribute = new THREE.InstancedBufferAttribute(new Float32Array(amplitude), 1)

    geometry.setAttribute('offset', new THREE.InstancedBufferAttribute(new Float32Array(offsets), 3))

    geometry.setAttribute('magnitude', magnitudeAttribute)
    geometry.setAttribute('amplitude', amplitudeAttribute)

    geometry.setAttribute('pickingColor', new THREE.InstancedBufferAttribute(new Float32Array(pickingColors), 3))

    return { geometry, magnitudeAttribute, amplitudeAttribute }
}

function setupMaterial() {
    let material = new THREE.MeshPhongMaterial({
        vertexColors: THREE.VertexColors,
    })

    material.onBeforeCompile = function (shader) {
        shader.vertexShader = 'attribute vec3 offset;\nattribute float magnitude;\nattribute float amplitude;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <color_vertex>',
            ['if (magnitude >= 0.0) {',
                'float red;',
                'if (magnitude < 0.7) { red = 4.0 * magnitude - 1.5; }',
                'else { red = -4.0 * magnitude + 4.5; }',
                'float green;',
                'if (magnitude < 0.5) { green = 4.0 * magnitude - 0.5; }',
                'else { green  = -4.0 * magnitude + 3.5; }',
                'float blue;',
                'if (magnitude < 0.3) { blue = 4.0 * magnitude + 0.5; }',
                'else { blue = -4.0 * magnitude + 2.5; }',
                'red = clamp(red, 0.0, 1.0);',
                'green = clamp(green, 0.0, 1.0);',
                'blue = clamp(blue, 0.0, 1.0);',
                'vColor.xyz = vec3(red, green, blue);',
                '}',
                'else {',
                'vColor.xyz = vec3(0.2, 0.2, 0.2);',
                '}'
            ].join('\n')
        )

        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
            [
                'vec3 vPosition = position;',
                'vec3 vOffset = offset;',
                'float scaling = 200.0 * amplitude;',
                'vOffset.y = (0.1 * scaling * 0.5);',
                'vPosition.y = position.y * scaling;',
                'vec3 transformed = vec3(vPosition + vOffset);',
            ].join('\n')
        )
        
        return shader
    }

    let pickingMaterial = new THREE.MeshBasicMaterial({
        vertexColors: THREE.VertexColors
    })

    pickingMaterial.onBeforeCompile = function (shader) {
        shader.vertexShader = 'attribute vec3 offset;\nattribute float amplitude;\nattribute vec3 pickingColor;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <color_vertex>',
            [
                'vColor.xyz = pickingColor;'
            ].join('\n')
        )

        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
            [
                'vec3 vPosition = position;',
                'vec3 vOffset = offset;',
                'float scaling = 200.0 * amplitude;',
                'vOffset.y = (0.1 * scaling * 0.5);',
                'vPosition.y = position.y * scaling;',
                'vec3 transformed = vec3(vPosition + vOffset);',
            ].join('\n')
        )
        
        return shader
    }

    return { material, pickingMaterial }
}

function setupScene(geometry, material) {
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x000000)

    let light = new THREE.DirectionalLight(0xffffff)
    light.position.set(0, 1, 0)
    scene.add(light)
    light = new THREE.AmbientLight(0x222222);
    scene.add(light)

    let tiles = new THREE.Mesh(geometry, material)
    tiles.frustumCulled = false

    scene.add(tiles)

    return scene
}

function setupPickingScene(renderer, geometry, pickingMaterial, camera) {
    const pickingScene = new THREE.Scene()

    var pickingRenderTarget = new THREE.WebGLRenderTarget(
        renderer.domElement.clientWidth, renderer.domElement.clientHeight
    )

    pickingRenderTarget.texture.generateMipmaps = false
    pickingRenderTarget.texture.minFilter = THREE.LinearFilter

    const picker = (x,y) => {
        renderer.setRenderTarget(pickingRenderTarget)
        renderer.render(pickingScene, camera)

        let pixelBuffer = new Uint8Array(4)

        renderer.readRenderTargetPixels(
            pickingRenderTarget,
            x,
            pickingRenderTarget.height - y,
            1,
            1,
            pixelBuffer
        )

        let id =
            (pixelBuffer[0] << 16) |
            (pixelBuffer[1] << 8) |
            (pixelBuffer[2])

        if (id > 0) {
            let electrodeNumber = id - 1
            document.getElementById("electrode-number-label").textContent =
                `${electrodeNumber}`
            document.getElementById("electrode-coord-label").textContent =
                `${Math.floor(electrodeNumber / 220)}, ${electrodeNumber % 220}`
        }

        renderer.setRenderTarget(null)
    }

    renderer.domElement.addEventListener('mousemove', (e) => {
        picker(e.clientX, e.clientY)
    })

    renderer.domElement.addEventListener('touchend', (e) => {
    //     e.preventDefault();
        picker(e.changedTouches[0].clientX, e.changedTouches[0].clientY)
    //     const x = (e.changedTouches[0].clientX / window.innerWidth) * 2 - 1
    //     const y = -(e.changedTouches[0].clientY / window.innerHeight) * 2 + 1

    //     console.log(`${x}, ${y}`)
    }, false)

    let pickingTiles = new THREE.Mesh(geometry, pickingMaterial)
    pickingTiles.frustumCulled = false

    pickingScene.add(pickingTiles)

    return pickingScene
}

export function drawSpikeVis(renderer, scene, {camera, controls},
     {magnitude, amplitude}) {

    magnitude.array = magnitude.array.map((magnitude) => {
        if (magnitude >= 0) {
            magnitude -= 0.016 / window.spikeDecay

            if (magnitude < 0.0) {
                magnitude = 0.0
            }
        }
        return magnitude
    })


    magnitude.needsUpdate = true

    amplitude.array = amplitude.array.map(amplitude => {
        if (amplitude >= 0) {
            amplitude *= 0.985

            if (amplitude < 0.0) {
                amplitude = 0.0
            }
        }
        
        return amplitude
    })

    amplitude.needsUpdate = true

    renderer.render(scene, camera)
    controls.update()
}

const setupSpikeVisualisation = () => {
    const renderer = setupRenderer()
    const cameraControls = setupCamera(renderer)

    const { geometry, magnitudeAttribute, amplitudeAttribute } = setupGeometry()
    const { material, pickingMaterial } = setupMaterial()

    const scene = setupScene(geometry, material)
    setupPickingScene(renderer, geometry, pickingMaterial, cameraControls.camera)

    return {
        renderer: renderer,
        scene: scene,
        cameraControls: cameraControls,
        attributes: {
            magnitude: magnitudeAttribute, 
            amplitude: amplitudeAttribute
        }
    }
}

export default setupSpikeVisualisation