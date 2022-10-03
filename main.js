import * as THREE from "three"
import { OrbitControls } from "OrbitControls"

const domElement = document.getElementById("cvs")
const output = document.getElementById("output")

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
const renderer = new THREE.WebGLRenderer({ canvas: domElement, antialias: true })

const controls = new OrbitControls(camera, domElement)

const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
const selected = { id: null, color: new THREE.Color(), locked: false }
const mouseState = { down: false }

await setup()
run()

async function setup() {
	renderer.setClearColor(0xF2BB05, 1.0)

	const globeRadius = 20, globeWidthSegments = 32, globeHeightSegments = 32 
	const globe = new THREE.Mesh(
		new THREE.SphereGeometry(globeRadius, globeWidthSegments, globeHeightSegments),
		new THREE.MeshStandardMaterial({ color: 0x124E78 }),
	)
	globe.name = "globe"
	scene.add(globe)

	////////////////////////////////////////////////////////////////
	// Load and draw geo.json data
	////////////////////////////////////////////////////////////////
	const data = await loadJSON("assets/earth.geo.json")
	const numOfFeatures = data.features.length

	let color = 0xF0F0C9
	for (let i = 0; i < numOfFeatures; i++) {
		let pointCount = data.features[i].geometry.coordinates.length

		let value = Math.random() * 0xEF | 0;
		let shade = ((value << 16) | (value << 8) | value) | color

		for (let j = 0; j < pointCount; j++) {
			let points = data.features[i].geometry.coordinates[j]
			if (points.length === 1) points = points[0]
			const mesh = createShapeMesh(points, globeRadius + 1.5, shade)
			mesh.name = data.features[i].properties.admin
			scene.add(mesh)
		}
	}
	////////////////////////////////////////////////////////////////

	const light = new THREE.AmbientLight({ color: 0xFFFFFF})
	scene.add(light)

	camera.position.set(0, 0, 55)
	camera.lookAt(0, 0, 0)
	resize()

	window.addEventListener("resize", resize)
	window.addEventListener("pointermove", onPointerMove)
	window.addEventListener("mousedown", onMouseDown)
	window.addEventListener("mouseup", onMouseUp)
}

function run() {
	controls.update()

	if (!mouseState.down && !pointer.locked) scene.rotateY(-0.0005)

	renderer.render(scene, camera)
	requestAnimationFrame(run)
}

// =============================================================
// Event handlers
// =============================================================
function resize() {
	renderer.setSize(window.innerWidth, window.innerHeight)

	camera.aspect = window.innerWidth / window.innerHeight
	camera.updateProjectionMatrix()
}

function onPointerMove(event) {
	if (mouseState.down) return
	
	pointer.x = (event.clientX / window.innerWidth) * 2 - 1
	pointer.y = - (event.clientY / window.innerHeight) * 2 + 1

	raycaster.setFromCamera(pointer, camera)
	const intersects = raycaster.intersectObjects(scene.children)

	if (intersects.length > 0 && intersects[0].object.name !== "globe") {
		if (selected.id !== intersects[0].object.id) {
			if (selected.id) {
				scene.getObjectById(selected.id).material.color = selected.color
			}

			selected.id = intersects[0].object.id
			selected.color = intersects[0].object.material.color.clone()

			intersects[0].object.material.color.set(0xD74E09)
			output.innerHTML = `<p class="name">${intersects[0].object.name}</p>` 
		}
	}
	else if (selected.id) {
		scene.getObjectById(selected.id).material.color = selected.color
		selected.id = null

		output.innerHTML = ""
	}
}

function onMouseDown(event) {
	mouseState.down = true
	selected.locked = false
}

function onMouseUp(event) {
	mouseState.down = false
}

// =============================================================
// Helpers
// =============================================================
async function loadJSON(filepath) {
	try {
		const res = await fetch(filepath)
		if (!res.ok) throw new Error("Failed to fetch file " + filepath)
		return await res.json()
	} catch (error) {
		console.error(error.message)
	}
	return null
}

function latLonToVec3(lat, lon, radius = 1.0, deg = true) {
	let result = new THREE.Vector3()

	if (deg) {
		lat = lat * Math.PI / 180.0
		lon = lon * Math.PI / 180.0
	}

	let l = Math.cos(lon)
	result.y = Math.sin(lon)
	result.x = Math.sin(lat) * l
	result.z = Math.cos(lat) * l

	return result.multiplyScalar(radius)
}

// =============================================================
// Utils
// =============================================================
function createPointMesh(coordinatesArray, globeRadius = 10, color = 0xA5F9AC) {
	if (!coordinatesArray) return null

	const count = coordinatesArray.length
	const matrix = new THREE.Matrix4()

	const pointMesh = new THREE.InstancedMesh(
		new THREE.SphereGeometry(0.05, 4, 4),
		new THREE.MeshBasicMaterial({ color }),
		count
	)

	for (let i = 0; i < count; i++) {
		matrix.setPosition(latLonToVec3(coordinatesArray[i][0], coordinatesArray[i][1], globeRadius))

		pointMesh.setMatrixAt(i, matrix)
	}

	return pointMesh
}

function createOutlineMesh(coordinatesArray, globeRadius = 10, color = 0xA5F9BC) {
	if (!coordinatesArray) return null

	const count = coordinatesArray.length
	const points = []
	for (let i = 0; i < count; i++) {
		points.push(latLonToVec3(coordinatesArray[i][0], coordinatesArray[i][1], globeRadius))
	}

	const geo = new THREE.BufferGeometry().setFromPoints(points)
	const mat = new THREE.LineBasicMaterial({ color })

	return new THREE.Line(geo, mat)
}

function createShapeMesh(coordinatesArray, globeRadius = 10, color = 0xA5F9AC) {
	if (!coordinatesArray) return null

	const count = coordinatesArray.length
	const shape = new THREE.Shape()
	for (let i = 0; i < count; i++) {
		let x = coordinatesArray[i][0] * Math.PI / 180.0
		let y = coordinatesArray[i][1] * Math.PI / 180.0
		if (i === 0) shape.moveTo(x, y)
		else shape.lineTo(x, y)
	}

	const geo = new THREE.ShapeGeometry(shape)

	let posAttrib = geo.attributes.position.array
	for (let i = 0; i < posAttrib.length; i += 3) {
		let lat = posAttrib[i]
		let lon = posAttrib[i + 1]
		let l = Math.cos(lon)

		posAttrib[i] = Math.sin(lat) * l * globeRadius
		posAttrib[i + 1] = Math.sin(lon) * globeRadius
		posAttrib[i + 2] = Math.cos(lat) * l * globeRadius
	}

	const mat = new THREE.MeshStandardMaterial({ color })

	return new THREE.Mesh(geo, mat)
}
