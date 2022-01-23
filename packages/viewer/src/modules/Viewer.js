import * as THREE from 'three'
import * as Geo from 'geo-three'

import Stats from 'three/examples/jsm/libs/stats.module.js'

import ObjectManager from './SceneObjectManager'
import ViewerObjectLoader from './ViewerObjectLoader'
import EventEmitter from './EventEmitter'
import InteractionHandler from './InteractionHandler'
import CameraHandler from './context/CameraHanlder'

import SectionBox from './SectionBox'

export default class Viewer extends EventEmitter {

  constructor( { container, postprocessing = false, reflections = true, showStats = false } ) {
    super()

    window.THREE = THREE

    this.clock = new THREE.Clock()
    
    this.container = container || document.getElementById( 'renderer' )
    this.postprocessing = postprocessing
    this.scene = new THREE.Scene()

    this.renderer = new THREE.WebGLRenderer( { antialias: true, alpha: true, preserveDrawingBuffer: true } )
    this.renderer.setClearColor( 0xcccccc, 0 )
    this.renderer.setPixelRatio( window.devicePixelRatio )
    this.renderer.setSize( this.container.offsetWidth, this.container.offsetHeight )
    this.container.appendChild( this.renderer.domElement )

    
    this.cameraHandler = new CameraHandler( this )

    this.reflections = reflections
    this.reflectionsNeedUpdate = true
    const cubeRenderTarget = new THREE.WebGLCubeRenderTarget( 512, { format: THREE.RGBFormat, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter } )
    this.cubeCamera = new THREE.CubeCamera( 0.1, 10_000, cubeRenderTarget )
    this.scene.add( this.cubeCamera )

    if ( showStats ) {
      this.stats = new Stats()
      this.container.appendChild( this.stats.dom )
    }

    window.addEventListener( 'resize', this.onWindowResize.bind( this ), false )

    this.mouseOverRenderer = false
    this.renderer.domElement.addEventListener( 'mouseover', () => { this.mouseOverRenderer = true } )
    this.renderer.domElement.addEventListener( 'mouseout', () => { this.mouseOverRenderer = false } )
    
    this.loaders = {}

    this.sectionBox = new SectionBox( this )
    this.sectionBox.off()

    this.sceneManager = new ObjectManager( this )
    this.interactions = new InteractionHandler( this )

    this.sceneLights()
    this.animate()
    this.onWindowResize()
    this.interactions.zoomExtents()
    this.addMap()
    this.needsRender = true

    this.inProgressOperations = 0
  }

  sceneLights() {

    // const dirLight = new THREE.DirectionalLight( 0xffffff, 0.1 )
    // dirLight.color.setHSL( 0.1, 1, 0.95 )
    // dirLight.position.set( -1, 1.75, 1 )
    // dirLight.position.multiplyScalar( 1000 )
    // this.scene.add( dirLight )
    
    // const dirLight2 = new THREE.DirectionalLight( 0xffffff, 0.9 )
    // dirLight2.color.setHSL( 0.1, 1, 0.95 )
    // dirLight2.position.set( 0, -1.75, 1 )
    // dirLight2.position.multiplyScalar( 1000 )
    // this.scene.add( dirLight2 )

    // const hemiLight2 = new THREE.HemisphereLight( 0xffffff, new THREE.Color( '#232323' ), 1.9 )
    // hemiLight2.color.setHSL( 1, 1, 1 )
    // // hemiLight2.groundColor = new THREE.Color( '#232323' )
    // hemiLight2.up.set( 0, 0, 1 )
    // this.scene.add( hemiLight2 )

    // let axesHelper = new THREE.AxesHelper( 1 )
    // this.scene.add( axesHelper )

    // return


    let ambientLight = new THREE.AmbientLight( 0xffffff )
    this.scene.add( ambientLight )

    const lights = []
    lights[ 0 ] = new THREE.PointLight( 0xffffff, 0.21, 0 )
    lights[ 1 ] = new THREE.PointLight( 0xffffff, 0.21, 0 )
    lights[ 2 ] = new THREE.PointLight( 0xffffff, 0.21, 0 )
    lights[ 3 ] = new THREE.PointLight( 0xffffff, 0.21, 0 )

    let factor = 1000
    lights[ 0 ].position.set( 1 * factor, 1 * factor, 1 * factor )
    lights[ 1 ].position.set( 1 * factor, -1 * factor, 1 * factor )
    lights[ 2 ].position.set( -1 * factor, -1 * factor, 1 * factor )
    lights[ 3 ].position.set( -1 * factor, 1 * factor, 1 * factor )

    this.scene.add( lights[ 0 ] )
    this.scene.add( lights[ 1 ] )
    this.scene.add( lights[ 2 ] )
    this.scene.add( lights[ 3 ] )

    // let sphereSize = 0.2
    // this.scene.add( new THREE.PointLightHelper( lights[ 0 ], sphereSize ) )
    // this.scene.add( new THREE.PointLightHelper( lights[ 1 ], sphereSize ) )
    // this.scene.add( new THREE.PointLightHelper( lights[ 2 ], sphereSize ) )
    // this.scene.add( new THREE.PointLightHelper( lights[ 3 ], sphereSize ) )

    const hemiLight = new THREE.HemisphereLight( 0xffffff, 0x0, 0.2 )
    hemiLight.color.setHSL( 1, 1, 1 )
    hemiLight.groundColor.setHSL( 0.095, 1, 0.75 )
    hemiLight.up.set( 0, 0, 1 )
    this.scene.add( hemiLight )

    
    let group = new THREE.Group()
    this.scene.add( group )
  }

  onWindowResize() {
    this.renderer.setSize( this.container.offsetWidth, this.container.offsetHeight )
    // this.composer.setSize( this.container.offsetWidth, this.container.offsetHeight )
    this.needsRender = true
  }

  animate() {
    const delta = this.clock.getDelta()
    
    const hasControlsUpdated = this.cameraHandler.controls.update( delta )
    // const hasOrthoControlsUpdated = this.cameraHandler.cameras[1].controls.update( delta )

    requestAnimationFrame( this.animate.bind( this ) )

    // you can skip this condition to render though
    if ( hasControlsUpdated || this.needsRender ) {
      this.needsRender = false
      if ( this.stats ) this.stats.begin()
      this.render()
      if( this.stats && document.getElementById( 'info-draws' ) )
        document.getElementById( 'info-draws' ).textContent = '' + this.renderer.info.render.calls
      if ( this.stats ) this.stats.end()
    }

  }

  render() {
    //console.log(this.cameraHandler.activeCam.camera.position)
    if ( this.reflections && this.reflectionsNeedUpdate ) {
      // Note: scene based "dynamic" reflections need to be handled a bit more carefully, or else:
      // GL ERROR :GL_INVALID_OPERATION : glDrawElements: Source and destination textures of the draw are the same.
      // First remove the env map from all materials
      for ( let obj of this.sceneManager.filteredObjects ) {
        obj.material.envMap = null
      }

      // Second, set a scene background color (renderer is transparent by default)
      // and then finally update the cubemap camera.
      this.scene.background = new THREE.Color( '#F0F3F8' )
      this.cubeCamera.update( this.renderer, this.scene )
      this.scene.background = null

      // Finally, re-set the env maps of all materials
      for ( let obj of this.sceneManager.filteredObjects ) {
        obj.material.envMap = this.cubeCamera.renderTarget.texture
      }
      this.reflectionsNeedUpdate = false
    }

    this.renderer.render( this.scene, this.cameraHandler.activeCam.camera )

  }

  toggleSectionBox() {
    this.sectionBox.toggle()
  }

  sectionBoxOff() {
    this.sectionBox.off()
  }

  sectionBoxOn() {
    this.sectionBox.on()
  }

  zoomExtents( fit, transition ) {
    this.interactions.zoomExtents( fit, transition )
  }

  setProjectionMode( mode ) {
    this.cameraHandler.activeCam = mode
  }

  toggleCameraProjection() {
    this.cameraHandler.toggleCameras()
  }

  async loadObject( url, token, enableCaching = true ) {
    try {
      if ( ++this.inProgressOperations === 1 ) this.emit( 'busy', true )

      let loader = new ViewerObjectLoader( this, url, token, enableCaching )
      this.loaders[ url ] = loader
      await loader.load()
    } finally {
       if ( --this.inProgressOperations === 0 ) this.emit( 'busy', false )
    }

  }
  async addMap() {
    //TODO: activate only on new selection, not just a click

    var selectedObject = this.scene.getObjectByName("Mapbox map")
    this.scene.remove( selectedObject );
    this.animate();

		//var DEV_MAPBOX_API_KEY = "pk.eyJ1IjoidGVudG9uZSIsImEiOiJjazBwNHU4eDQwZzE4M2VzOGhibWY5NXo5In0.8xpF1DEcT6Y4000vNhjj1g";
		var DEV_MAPBOX_API_KEY = "pk.eyJ1Ijoia2F0LXNwZWNrbGUiLCJhIjoiY2t5cm1oZDZmMHZkbTJxbzVhdnkxeGYzaCJ9.JXufxeNiDCDDi5JgzUrsbQ";
    var DEV_HEREMAPS_APP_ID = "HqSchC7XT2PA9qCfxzFq";
		var DEV_HEREMAPS_APP_CODE = "5rob9QcZ70J-m18Er8-rIA";
		var DEV_BING_API_KEY = "AuViYD_FXGfc3dxc0pNa8ZEJxyZyPq1lwOLPCOydV3f0tlEVH-HKMgxZ9ilcRj-T";
		var DEV_MAPTILER_API_KEY = "B9bz5tIKxl4beipiIbR0";
		var OPEN_MAP_TILES_SERVER_MAP = "";
    
    // adding map tiles
    var providers = [
			["Vector OpenSteet Maps", new Geo.OpenStreetMapsProvider()], // works until specific zoom
			["Vector OpenTile Maps", new Geo.OpenMapTilesProvider(OPEN_MAP_TILES_SERVER_MAP)],// N/A
			["Vector Map Box", new Geo.MapBoxProvider(DEV_MAPBOX_API_KEY, "mapbox/streets-v10", Geo.MapBoxProvider.STYLE)], //works (custom token)
			["Vector Here Maps", new Geo.HereMapsProvider(DEV_HEREMAPS_APP_ID, DEV_HEREMAPS_APP_CODE, "base", "normal.day")], // works until specific zoom
			["Vector Here Maps Night", new Geo.HereMapsProvider(DEV_HEREMAPS_APP_ID, DEV_HEREMAPS_APP_CODE, "base", "normal.night")], // works until specific zoom
			["Vector Here Maps Terrain", new Geo.HereMapsProvider(DEV_HEREMAPS_APP_ID, DEV_HEREMAPS_APP_CODE, "aerial", "terrain.day")], // works until specific zoom
			["Vector Bing Maps", new Geo.BingMapsProvider(DEV_BING_API_KEY, Geo.BingMapsProvider.ROAD)], //works
			["Vector Map Tiler Basic", new Geo.MapTilerProvider(DEV_MAPTILER_API_KEY, "maps", "basic", "png")], //works
			["Vector Map Tiler Outdoor", new Geo.MapTilerProvider(DEV_MAPTILER_API_KEY, "maps", "outdoor", "png")],	//works
			["Satellite Map Box", new Geo.MapBoxProvider(DEV_MAPBOX_API_KEY, "mapbox.satellite", Geo.MapBoxProvider.MAP_ID, "jpg70", false)], //works (custom token)
			["Satellite Map Box Labels", new Geo.MapBoxProvider(DEV_MAPBOX_API_KEY, "mapbox/satellite-streets-v10", Geo.MapBoxProvider.STYLE, "jpg70")], //works (custom token)
			["Satellite Here Maps", new Geo.HereMapsProvider(DEV_HEREMAPS_APP_ID, DEV_HEREMAPS_APP_CODE, "aerial", "satellite.day", "jpg")], // works until specific zoom
			["Satellite Bing Maps", new Geo.BingMapsProvider(DEV_BING_API_KEY, Geo.BingMapsProvider.AERIAL)], //works
			["Satellite Maps Tiler Labels", new Geo.MapTilerProvider(DEV_MAPTILER_API_KEY, "maps", "hybrid", "jpg")], //works but low resolution
			["Satellite Maps Tiler", new Geo.MapTilerProvider(DEV_MAPTILER_API_KEY, "tiles", "satellite", "jpg")], //works but low resolution
			["Height Map Box", new Geo.MapBoxProvider(DEV_MAPBOX_API_KEY, "mapbox.terrain-rgb", Geo.MapBoxProvider.MAP_ID, "pngraw")], //works (custom token)
			["Height Map Tiler", new Geo.MapTilerProvider(DEV_MAPTILER_API_KEY, "tiles", "terrain-rgb", "png")], // N/A
			["Debug Height Map Box", new Geo.HeightDebugProvider(new Geo.MapBoxProvider(DEV_MAPBOX_API_KEY, "mapbox.terrain-rgb", Geo.MapBoxProvider.MAP_ID, "pngraw"))],
			["Debug", new Geo.DebugProvider()] //custom
		];
    //TODO: choose maps, get tokens

    var providerColor = document.getElementById("providerColor");
		providerColor.onchange = function (event) {
			if (map !== undefined) {
				map.setProvider(providers[event.target.selectedIndex][1]);
			}
		};
		for (var i = 0; i < providers.length + 1 ; i++) {
			var option = document.createElement("option");
      if (i>0) option.innerHTML = providers[i-1][0];
      else option.innerHTML = "No map";
			providerColor.appendChild(option);
		}
    //providerColor.selectedIndex = 0;

    var modes = [
			["Planar", Geo.MapView.PLANAR],
			["Height", Geo.MapView.HEIGHT],
			// ["Martini", Geo.MapView.MARTINI],
			["Height Shader", Geo.MapView.HEIGHT_SHADER],
			["Spherical", Geo.MapView.SPHERICAL]
		];
    
    // example building https://latest.speckle.dev/streams/8b29ca2b2e/objects/288f67a0a45b2a4c3bd01f7eb3032495

    if (providerColor.selectedIndex >0){
      //var map = new Geo.MapView(modes[0][1], providers[val][1], providers[val][1]);
      var map = new Geo.MapView(modes[0][1], providers[providerColor.selectedIndex-1][1], providers[providerColor.selectedIndex-1][1]);
      
      map.name = "Mapbox map"
      this.scene.add(map);
      map.rotation.x += 90*Math.PI/180;
      
      var scale = 1; //meters
      map.scale.set(map.scale.x*scale,map.scale.y*scale,map.scale.z*scale)
      
      var x_coord = Number(document.getElementById( 'zeroCoordInputX' ).value)
      var y_coord = Number(document.getElementById( 'zeroCoordInputY' ).value)

      //TODO: transform coordinates to meters in Mapbox coord system:  Web Mercator projection with the EPSG:3857 projected coordinate system
      map.position.x -= x_coord*scale; // to the East
      map.position.y -= y_coord*scale; // to the North //5753040*scale*1.1665
      this.animate();
    }
    //TODO: keep rendering until the map is loaded
  }
  removeMap(){
    //console.log(this.scene.children[11])
    var selectedObject = this.scene.getObjectByName("Mapbox map")
    this.scene.remove( selectedObject );
    this.animate();
  }

  async cancelLoad( url, unload = false ) {
    this.loaders[url].cancelLoad()
    if( unload ) {
      await this.unloadObject( url )
    }
    return
  }

  async unloadObject( url ) {
    try {
      if ( ++this.inProgressOperations === 1 ) this.emit( 'busy', true )

      await this.loaders[ url ].unload()
      delete this.loaders[ url ]
    } finally {
       if ( --this.inProgressOperations === 0 ) this.emit( 'busy', false )
    }
  }

  async unloadAll() {
    for( let key of Object.keys( this.loaders ) ) {
      await this.loaders[key].unload()
      delete this.loaders[key]
    }
    await this.applyFilter( null )
    return
  }

  async applyFilter( filter ) {
    try {
      if ( ++this.inProgressOperations === 1 ) this.emit( 'busy', true )

      this.interactions.deselectObjects()
      return await this.sceneManager.sceneObjects.applyFilter( filter )
    } finally {
       if ( --this.inProgressOperations === 0 ) this.emit( 'busy', false )
    }

  }

  getObjectsProperties( includeAll = true ) {
    return this.sceneManager.sceneObjects.getObjectsProperties( includeAll )
  }

  dispose() {
    // TODO: currently it's easier to simply refresh the page :)
  }
}
