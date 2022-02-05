import * as THREE from 'three'
import * as Geo from 'geo-three'
import InteractionHandler from './InteractionHandler'
import { Units, getConversionFactor } from './converter/Units'

export default class SceneSurroundings {

  constructor( viewer, index, lat, lon, north, api, build ) {
    this.viewer = viewer
    this.interactions = new InteractionHandler( this.viewer )

        
    this.DEV_MAPBOX_API_KEY = api
    this.north = north
    this.selectedMapIndex = index
    this.lat = lat
    this.lon = lon
    this.buildings3d = build
    this.buildingsAmount = 0
    
    // adding map tiles
    this.map_providers = [
      [ 'No map' ],
      [ 'Mapbox Light', new Geo.MapBoxProvider( this.DEV_MAPBOX_API_KEY, 'kat-speckle/ckz59opgu003y15p4hi2fib4d', Geo.MapBoxProvider.STYLE ), 0xa6a6a6 ], //works (custom token)
      [ 'Mapbox Dark', new Geo.MapBoxProvider( this.DEV_MAPBOX_API_KEY, 'kat-speckle/ckz59co9z002414nkyty48va3', Geo.MapBoxProvider.STYLE ), 0x2b2b2b ] //works (custom token)
      ]
    
    this.map_modes = [
      [ 'Planar', Geo.MapView.PLANAR ],
      [ 'Height', Geo.MapView.HEIGHT ],
      // ["Martini", Geo.MapView.MARTINI],
      [ 'Height Shader', Geo.MapView.HEIGHT_SHADER ],
      [ 'Spherical', Geo.MapView.SPHERICAL ]
    ]
    
    this.addUnitsList()
    this.addMapsList()

  }

  addUnitsList() {
    if ( document.getElementById( 'mapUnits' ) ) {
      let mapUnits = document.getElementById( 'mapUnits' )

      for ( let key of Object.keys( Units ) ) {
      let option = document.createElement( 'option' )
      option.innerHTML = Units[key]
      mapUnits.appendChild( option )
      }
    }
  }
  addMapsList() {
    if ( document.getElementById( 'providerColor' ) ) {
      let providerColor = document.getElementById( 'providerColor' )

      for ( let i = 0; i < this.map_providers.length;  i++ ) {
      let option = document.createElement( 'option' )
      option.innerHTML = this.map_providers[i][0]
      providerColor.appendChild( option )
      }
    }
  }
  selectedMap( index = -1 ) {
    let selected = 0
    let providerColor = document.getElementById( 'providerColor' )
    if ( index >= 0 ) this.selectedMapIndex = index
    if ( this.selectedMapIndex ) selected = this.selectedMapIndex
    else if ( providerColor ) selected = providerColor.selectedIndex
    return selected
  }
  getBuildings3d( build = null ) {
    if ( build !== null ) this.buildings3d = build
    return this.buildings3d
  }
  async addMap() {
    //this.addBuildings()
    // example building https://latest.speckle.dev/streams/8b29ca2b2e/objects/288f67a0a45b2a4c3bd01f7eb3032495

    let selectedMap = this.selectedMap()
    let coords = this.getCoords()[0]
    let scale = this.getScale()
    let rotationNorth = this.rotationNorth()
    let build = this.getBuildings3d()

    this.removeMap()
    this.hideBuild()
    console.log( selectedMap )
    console.log( build )

    if ( !this.viewer.scene.getObjectByName( 'OSM 3d buildings' ) )  this.addBuildings() // add if there are no buildings in the scene yet
    if ( this.viewer.scene.getObjectByName( 'OSM 3d buildings' ) && ( build === true && selectedMap !== 0 ) )  this.showBuild() // if there are buildings in the scene: if toggle is TRUE and map is not 0: show and change color, scale, rotation 

    if ( selectedMap > 0 ) {
      //create and add map to scene
      let map = new Geo.MapView( this.map_modes[0][1], this.map_providers[selectedMap][1], this.map_providers[selectedMap][1] )
      map.name = 'Base map'
      this.viewer.scene.add( map )
      map.rotation.x += Math.PI / 2

      //set selected map provider
      map.setProvider( this.map_providers[selectedMap][1] )
          
      map.scale.set( map.scale.x / scale, map.scale.y / scale, map.scale.z / scale )

      map.rotation.y += rotationNorth //rotate around (0,0,0)

      let movingVector = new THREE.Vector3( coords.x / scale, coords.y / scale, 0 ) //get vector to correct location on the map
      let rotatedVector = movingVector.applyAxisAngle( new THREE.Vector3( 0,0,1 ), rotationNorth ) //rotate vector same as the map
      map.position.x -= rotatedVector.x
      map.position.y -= rotatedVector.y
      
      this.interactions.rotateCamera( 0.001 ) //to activate map loading
    }
  }
  getScale() {
    let scale = 1 //m
    let scale_units = 'm'
    if ( document.getElementById( 'mapUnits' ) ) {
      scale_units = document.getElementById( 'mapUnits' ).value
      scale = getConversionFactor( scale_units )
    }
    return scale // set 1 for meters
  }
  getCoords() {
    let coord_lat = 51.499268
    let coord_lon = -0.122141
    let coords_transformed = Geo.UnitsUtils.datumsToSpherical( coord_lat,coord_lon )
    if ( this.lat && this.lon ) {
      coord_lat = this.lat
      coord_lon = this.lon
      coords_transformed = Geo.UnitsUtils.datumsToSpherical( coord_lat,coord_lon )
    }
    else if ( document.getElementById( 'zeroCoordInputX' ) && document.getElementById( 'zeroCoordInputY' ) ) {
      coord_lat = Number( document.getElementById( 'zeroCoordInputX' ).value )
      coord_lon = Number( document.getElementById( 'zeroCoordInputY' ).value )
      coords_transformed = Geo.UnitsUtils.datumsToSpherical( coord_lat,coord_lon )
    }
    return [ coords_transformed, coord_lat, coord_lon ]
  }
  rotationNorth() {
    if ( this.north ) return this.north
    else if ( document.getElementById( 'North angle' ) ) {
      let angle = Number( document.getElementById( 'North angle' ).value )
      return -angle * Math.PI / 180
    }
    else return 0
  }

  async removeMap() {
    let selectedObject = this.viewer.scene.getObjectByName( 'Base map' )
    this.viewer.scene.remove( selectedObject )    
    this.viewer.render()
  }
  async removeBuild() {
    let objects = this.viewer.scene.children 
    for ( let i = 0, len = objects.length; i < len; i++ ) {
      if ( objects[i].name === 'OSM 3d buildings' ) this.viewer.scene.remove( objects[i] )
    }
    this.viewer.render()
  }
  hideBuild() {
    console.log( 'hide buildings' )
    let objects = this.viewer.scene.children 
    for ( let i = 0, len = objects.length; i < len; i++ ) {
      if ( objects[i].name === 'OSM 3d buildings' ) objects[i].visible = false
    }
    this.viewer.render()
  }
  showBuild() {
    console.log( 'show buildings' )
    let selectedMap = this.selectedMap()
    let c = this.map_providers[selectedMap][2]
    let mat = this.viewer.sceneManager.solidMaterial.clone()
    //let rotationNorth = this.rotationNorth()
    //let scale = this.getScale()

    if ( this.buildings3d === true && selectedMap !== 0 ) {
      this.viewer.scene.traverse( function( child ) {
        if ( child.name === 'OSM 3d buildings' ) {
          mat.color = new THREE.Color( c )
          child.material = mat
          child.visible = true
          /*
          let movingVector = new THREE.Vector3( 0, 0, 0 )
          let rotatedVector = new THREE.Vector3( 0, 0, 0 )
          
          // bring mesh to zero coord and rotate
          movingVector = new THREE.Vector3( child.position.x, child.position.y, 0 ) //get vector to correct location on the map
          child.position.x -= movingVector.x
          child.position.y -= movingVector.y
          child.rotation.y += rotationNorth - child.rotation.y //rotate around (0,0,0)

          // move mesh back, but rotate the initial vector as well
          rotatedVector = movingVector.applyAxisAngle( new THREE.Vector3( 0,0,1 ), rotationNorth - child.rotation.y ) //rotate vector same as the map
          child.position.x += rotatedVector.x
          child.position.y += rotatedVector.y

          //adjust scale
          child.scale.set( 1 / scale, 1 / scale, 1 / scale )
          */

        }
      } )
    }
    this.viewer.render()
  }
  
  changeMapOpacity( val = 0.5 ) {
    let selectedObject = this.viewer.scene.getObjectByName( 'Base map' )
    selectedObject.material.opacity = val
  }


  addBuildings() {
    //EPSG:900913
    console.log( 'Get Json' )
    //let rad = 0.1 // in selected units. e.g. meters

    let coord_lat = this.getCoords()[1]
    let coord_lon = this.getCoords()[2]
    // calculate meters per degree ratio for lat&lon - to get bbox RADxRAD (m) for API expressed in degrees
    let coords_world_origin = Geo.UnitsUtils.datumsToSpherical( coord_lat, coord_lon )        //{x: -9936.853648995217, y: 6711437.084992493}
    let coords_world_origin_lat = Geo.UnitsUtils.datumsToSpherical( coord_lat + 1, coord_lon ).y
    let coords_world_origin_lon = Geo.UnitsUtils.datumsToSpherical( coord_lat, coord_lon + 1 ).x
    let lat_coeff = Math.abs( coords_world_origin_lat - coords_world_origin.y )               // 111319.49079327358
    let lon_coeff = Math.abs( coords_world_origin_lon - coords_world_origin.x )               // 180850.16131539177

    let rad = 1500 // in selected units. e.g. meters
    //let bbox1 = [ coord_lon - rad / lon_coeff, coord_lat - rad / lat_coeff, coord_lon + rad / lon_coeff, coord_lat + rad / lat_coeff ]
    let y0 = coord_lat - rad / lat_coeff
    let y1 = coord_lat + rad / lat_coeff
    let x0 = coord_lon - rad / lon_coeff
    let x1 = coord_lon + rad / lon_coeff
    //console.log( this.getCoords()[0] ) //{x: -13596.673924981229, y: 6710088.186358106}
    /*
    let key = 'building'
    let bounds = {
      'type': 'Feature',
      'geometry': {
        'type': 'Polygon',
        'coordinates': [ [ [ x0, y1 ], [ x0, y0 ], [ x1, y0 ], [ x1, y1 ], [ x0, y1 ] ] ]
      },
      'properties': {}
    }
    let queryData =  OSMBuildQuery( key, bounds )
    */
    // [out:json][timeout:90];(node["building"](-0.13561572926179283,51.49097244295009,-0.10866627073820717,51.50756355704991);way["building"](-0.13561572926179283,51.49097244295009,-0.10866627073820717,51.50756355704991);relation["building"](-0.13561572926179283,51.49097244295009,-0.10866627073820717,51.50756355704991););out body;>;out skel qt;
    // https://overpass-api.de/api/interpreter?data=[out:json][timeout:500];(node["building"](51.49851657345265,-0.10273900435130523,51.515104891528665,-0.07578954582771957);way["building"](51.49851657345265,-0.10273900435130523,51.515104891528665,-0.07578954582771957);relation["building"](51.49851657345265,-0.10273900435130523,51.515104891528665,-0.07578954582771957);node["man_made"="bridge"](51.49851657345265,-0.10273900435130523,51.515104891528665,-0.07578954582771957);way["man_made"="bridge"](51.49851657345265,-0.10273900435130523,51.515104891528665,-0.07578954582771957);relation["man_made"="bridge"](51.49851657345265,-0.10273900435130523,51.515104891528665,-0.07578954582771957););out body;>;out skel qt;


    let bbox = y0.toString() + ',' + x0.toString() + ',' + y1.toString() + ',' + x1.toString()
    let query_start = 'https://overpass-api.de/api/interpreter?data=[out:json][timeout:500];('
    let query1 = 'node["building"](' + bbox + ');way["building"](' + bbox + ');relation["building"](' + bbox + ');'
    let query2 = 'node["man_made"="bridge"](' + bbox + ');way["man_made"="bridge"](' + bbox + ');relation["man_made"="bridge"](' + bbox + ');'
    let query_end = ');out body;>;out skel qt;'

    let url = query_start + query1 + query_end
    console.log( url )
    let client = new XMLHttpRequest()
    let thisContext = this
    let scale = this.getScale()

    client.onreadystatechange = function() {
    if ( this.readyState === 4 && this.status === 200 ) {
        // Action to be performed when the document is ready:
        let features = JSON.parse( client.responseText ).elements
        thisContext.jsonAnalyse( features )
      }
    }
    client.open( 'GET', url )
    client.send()
  }

  jsonAnalyse ( features ) {
    let ways = []
    let tags = []

    let relations = []
    let tags_relations = []

    let ways_part = []
    let nodes = []
    
    let origin = this.getCoords()[0]

    for ( let i = 0; i < features.length;  i++ ) {
      let feature = features[i]
      // get ways
      if ( feature.type === 'way' ) {
        if ( feature.tags ) {
          ways.push( { id: feature.id, nodes: feature.nodes } )
          tags.push( { building: feature.tags['building'], layer: feature.tags['layer'], levels: feature.tags['building:levels'], height: feature.tags['height'] } )
        }
        else ways_part.push( { id: feature.id, nodes: feature.nodes } )
      }
      // get relations
        if ( feature.type === 'relation' ) {
          for ( let n = 0; n < feature.members.length; n++ ) {
            // TODO: if several Outer ways, combine them
            if ( feature.members[n].type === 'way' && feature.members[n].role === 'outer' ) {
              relations.push( { ref: feature.members[n].ref } )
              if ( feature.tags ) tags_relations.push( { building: feature.tags['building'], layer: feature.tags['layer'], levels: feature.tags['building:levels'], height: feature.tags['height'] } )
              else tags_relations.push( {} )
            }
          }
        }
      // get nodes (that don't have tags)
      if ( feature.type === 'node' && !feature.tags ) nodes.push( { id: feature.id, lat: feature.lat, lon: feature.lon } )
    }
    /////////////////// turn relations into ways
    for ( let n = 0; n < relations.length; n++ ) { // go through relations
      for ( let k = 0; k < ways_part.length; k++ ) { // go through ways (that don't have tags)
        if ( k === ways_part.length ) break
        if ( relations[n].ref === ways_part[k].id ) {
          ways.push( { nodes: ways_part[k].nodes } ), tags.push( { building: tags_relations[n].building, layer: tags_relations[n].layer, levels: tags_relations[n].levels, height: tags_relations[n].height } )
          ways_part.splice( k, 1 ) // remove used ways_parts
          k -= 1 // reset index
          //console.log( ways_part.length )
          break
        }
      }
    }
    this.buildingsAmount = ways.length
    
    ////////////////////////get coords of Ways
    for ( let i = 0; i < ways.length;  i++ ) { // go through each Way: 2384
      
      let ids = ways[i].nodes
      let coords = [] //replace node IDs with actual coords for each Way
      let height = 3
      if ( tags[i].building ) height = 9
      if ( tags[i].levels ) height = Number( tags[i].levels.split( ',' )[0].split( ';' )[0].replace( /[^\d.-]/g, '' ) ) * 3
      else if ( tags[i].height ) height = Number( tags[i].height.split( ',' )[0].split( ';' )[0].replace( /[^\d.-]/g, '' ) )
      if ( tags[i].layer < 0 ) height = -1 * height
      
      for ( let k = 0; k < ids.length;  k++ ) { // go through each node of the Way
        for ( let n = 0; n < nodes.length;  n++ ) { // go though all nodes
          if ( ids[k] === nodes[n].id ) {
            coords.push( { x: Geo.UnitsUtils.datumsToSpherical( nodes[n].lat, nodes[n].lon ).x - origin.x, y: Geo.UnitsUtils.datumsToSpherical( nodes[n].lat, nodes[n].lon ).y - origin.y } )
            break
          }
        }
      }
      this.extrudeBuildings( coords, height )
      coords = null
      height = null
    }    
  }

  extrudeBuildings( coords, height ) { 
    let path = new THREE.ShapePath()
    if ( coords.length > 1 ) {
      path.moveTo( coords[0].x, coords[0].y )
      for ( let i = 1; i < coords.length; i++ ) {
        path.lineTo( coords[i].x, coords[i].y )
      }
    }
    let shapes = path.toShapes() 
    let extrudePath = new THREE.CurvePath()
		extrudePath.add( new THREE.LineCurve3( new THREE.Vector3( 0,0,0 ), new THREE.Vector3( 0,height,0 ) ) )
    let geom = new THREE.ExtrudeGeometry( shapes, { extrudePath: extrudePath } )

    /////// get model data and create Mesh
    let scale = this.getScale()
    let coord_lat = this.getCoords()[1]
    let coord_lon = this.getCoords()[2]
    let selectedMap = this.selectedMap()
    let visibility = this.getBuildings3d()
    let rotationNorth = this.rotationNorth()

    let color = 0x8D9194 //grey
    if ( selectedMap > 0 ) color = this.map_providers[selectedMap][2]
    let material = this.viewer.sceneManager.solidMaterial.clone()
    material.color = new THREE.Color( color )
    
    let m = new THREE.Mesh( geom, material )
    m.name = 'OSM 3d buildings'
    m.userData.coords = new THREE.Vector3( coord_lon[0], coord_lat[1],0 ) //original coordinates from Globals
    
    // add to scene, rotate to XY plane and scale
    this.viewer.scene.add( m )
    m.visible = visibility
    m.rotation.x += Math.PI / 2
    m.rotation.y -= Math.PI / 2
    m.scale.set( 1 / scale, 1 / scale, 1 / scale )

    // bring mesh to zero coord and rotate
    let movingVector = new THREE.Vector3( m.position.x, m.position.y, 0 ) //get vector to correct location on the map
    m.position.x -= movingVector.x
    m.position.y -= movingVector.y
    m.rotation.y += rotationNorth //rotate around (0,0,0)

    // move mesh back, but rotate the initial vector as well
    let rotatedVector = movingVector.applyAxisAngle( new THREE.Vector3( 0,0,1 ), rotationNorth ) //rotate vector same as the map
    m.position.x += rotatedVector.x
    m.position.y += rotatedVector.y
    
  }

}