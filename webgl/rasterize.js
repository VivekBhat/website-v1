/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const INPUT_TRIANGLES_URL = "https://ncsucgclass.github.io/prog2/triangles.json"; // triangles file loc
const INPUT_SPHERES_URL = "https://ncsucgclass.github.io/prog2/ellipsoids.json"; // ellipsoids file loc
const INPUT_LIGHTS_URL = "https://ncsucgclass.github.io/prog2/lights.json"; // lights file loc

var Eye = new vec4.fromValues(0.5, 0.5, -0.5, 1.0); // default eye position in world space
var eye = new vec3.fromValues(0.5, 0.5, -0.5);
var up = new vec4.fromValues(0, 1, 0, 1);
var center = [0.5, 0.5, 0.5, 1];
var lookat = new vec3.fromValues(0.5, 0.5, 0.5);

/* webgl globals */
var gl = null; // the all powerful gl object. It's all here folks!
var vertexBuffer; // this contains vertex coordinates in triples
var triangleBuffer; // this contains indices into vertexBuffer in triples
var triBufferSize = 0; // the number of indices in the triangle buffer
var vertexPositionAttrib; // where to put position for vertex shader
var vertexColorAttrib; // color of vertex

// Some constants
let maxYtoZ = 179;
let maxYtoX = 359;
let pi = Math.PI;

var canvas;

// Transforms
var xTransform = 0;
var yTransform = 0;
var zTransform = 0;

var coordArray = []; // 1D array of vertex coords for WebGL
var indexArray = []; // 1D array of vertex indices for WebGL

var vtxBufferSize = 0; // the number of vertices in the vertex buffer

var triNum = 0;
var ellNum = 0;

// Changing the light variable
var light_choice = 0;
var light_n = 0;

// Changing the color variable
var change_ambient = 0.0;
var change_diffuse = 0.0;
var change_specular = 0.0;

// select model variable
var selectTri = -1;
var selectEll = -1;

var rotMatrix = mat4.create();
var viewMatrix = mat4.create();


// ASSIGNMENT HELPER FUNCTIONS
// get the JSON file from the passed URL
function getJSONFile(url, descr) {
    try {
        if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET", url, false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now() - startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open " + descr + " file!";
            else
                return JSON.parse(httpReq.response);
        } // end if good params
    } // end try

    catch (e) {
        console.log(e);
        return (String.null);
    }
} // end get json file

// set up the webGL environment
function setupWebGL() {

    // Get the canvas and context
    canvas = document.getElementById("myWebGLCanvas"); // create a js canvas
    gl = canvas.getContext("webgl"); // get a webgl object from it

    // w = canvas.width;
    // h = canvas.height;

    try {
        if (gl == null) {
            throw "unable to create gl context -- is your browser gl ready?";
        } else {
            gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
            gl.clearDepth(1.0); // use max when we clear the depth buffer
            gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
        }
    } // end try

    catch (e) {
        console.log(e);
    } // end catch

} // end setupWebGL

// read triangles in, load them into webgl buffers
function loadTriangles() {
    var inputTriangles = getJSONFile(INPUT_TRIANGLES_URL, "triangles");
    var lights = getJSONFile(INPUT_LIGHTS_URL, "light");

    if (inputTriangles != String.null) {
        var whichSetVert; // index of vertex in current triangle set
        var whichSetTri; // index of triangle in current triangle set

        var vtxToAdd = []; // vtx coords to add to the coord array
        var indexOffset = vec3.create(); // the index offset for the current set
        var triToAdd = vec3.create(); // tri indices to add to the index array

        triNum = inputTriangles.length;

        for (var whichSet = 0; whichSet < inputTriangles.length; whichSet++) {
            vec3.set(indexOffset, vtxBufferSize, vtxBufferSize, vtxBufferSize); // update vertex offset

            var ambient_color = inputTriangles[whichSet].material.ambient;
            var diffuse_color = inputTriangles[whichSet].material.diffuse;
            var specular_color = inputTriangles[whichSet].material.specular;
            var powidx_n = inputTriangles[whichSet].material.n;

            var triangle_center = [0, 0, 0];

            //change selected color
            if (whichSet == selectTri) {
                powidx_n += light_n;
                powidx_n %= 21;
                ambient_color = addColor(ambient_color, change_ambient);
                diffuse_color = addColor(diffuse_color, change_diffuse);
                specular_color = addColor(specular_color, change_specular);
            }

            //compute triangle center
            for (whichSetVert = 0; whichSetVert < inputTriangles[whichSet].vertices.length; whichSetVert++) {
                var coordinates = inputTriangles[whichSet].vertices[whichSetVert];
                triangle_center[0] += coordinates[0] / inputTriangles[whichSet].vertices.length;
                triangle_center[1] += coordinates[1] / inputTriangles[whichSet].vertices.length;
                triangle_center[2] += coordinates[2] / inputTriangles[whichSet].vertices.length;
            }

            triangle_center = translate(triangle_center, xTransform, yTransform, zTransform);//move whole model when press key

            // set up the vertex coord array
            for (whichSetVert = 0; whichSetVert < inputTriangles[whichSet].vertices.length; whichSetVert++) {
                var coord = inputTriangles[whichSet].vertices[whichSetVert];
                if (whichSet == selectTri) {
                    coord = scale(coord, triangle_center, 1.2);//highlight selected triangle
                    coord = rotate(coord, triangle_center, rotMatrix);//rotate selected triangle when press key
                    coord = translate(coord, -xTransform, -yTransform, -zTransform);
                }

                coord = rotate(coord, lookat, viewMatrix); //rotate view when press key
                vtxToAdd = coord;
                coordArray.push(vtxToAdd[0], vtxToAdd[1], vtxToAdd[2]);

                var normal = inputTriangles[whichSet].normals[whichSetVert];
                var color = get_lighting(eye, lights, normal, inputTriangles[whichSet].vertices[whichSetVert],
                    ambient_color, diffuse_color, specular_color, powidx_n);
                coordArray.push(color[0], color[1], color[2]);
                vtxBufferSize += 1;
            } // end for vertices in set

            // set up the triangle index array, adjusting indices across sets
            for (whichSetTri = 0; whichSetTri < inputTriangles[whichSet].triangles.length; whichSetTri++) {
                vec3.add(triToAdd, indexOffset, inputTriangles[whichSet].triangles[whichSetTri]);
                indexArray.push(triToAdd[0], triToAdd[1], triToAdd[2]);
                triBufferSize += 3;
            } // end for triangles in set

        } // end for each triangle set

    } // end if triangles found
} // end load triangles

// setup the webGL shaders
// Source: http://learningwebgl.com/blog/?p=28
function setupShaders() {

    var mvMatrix = mat4.create();
    mat4.lookAt(mvMatrix, Eye, center, up);

    var pMatrix = mat4.create();

    /**
     * Here we’re setting up the perspective with which we want to view the scene.
     * By default, WebGL will use orthographic projection in which it will draw things that
     * are close by the same size as things that are far away.
     *
     * For this scene, we’re saying that our (vertical) field of view is 45° (or pi / 2 ),
     * we’re telling it about the width-to-height ratio of our canvas, and saying that
     * we don’t want to see things that are closer than 0.1 units to our viewpoint,
     * and that we don’t want to see things that are further away than 10 units.
     */

    mat4.perspective(pMatrix, pi / 2, canvas.width / canvas.height, 0.1, 10);

    var modelViewMatrixLocation;
    var projectionMatrixLocation;

    // define fragment shader in essl using es6 template strings
    var fShaderCode = `
        precision mediump float;
        varying mediump vec4 v_Color;
        void main(void) {
      //      gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0); // all fragments are white
            gl_FragColor = v_Color;
        }
    `;

    // define vertex shader in essl using es6 template strings
    var vShaderCode = `
        precision mediump float;
        
        // Vertex Position
        attribute vec3 vertexPosition;
        
        // Vertex Color 
        attribute vec3 vertexColor;
        varying lowp vec4 v_Color;
        
        // Defining the uniform matrices
        // Uniform variables are useful because they can be accessed from outside the shader
        uniform mat4 uniformModelViewMatrix; 
        uniform mat4 uniformProjectionMatrix;
        

        void main(void) {
            gl_Position = 
            uniformProjectionMatrix * uniformModelViewMatrix * vec4(vertexPosition, 1.0);
            v_Color = vec4(vertexColor,1.0);
        }
    `;

    try {
        // console.log("fragment shader: "+fShaderCode);
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader, fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        // console.log("vertex shader: "+vShaderCode);
        var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader, vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution

        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);
            gl.deleteShader(vShader);
        } else { // no compile errors
            var shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            //    gl.uniformMatrix4fv(projectionMatrixLocation, false, pMatrix);
            //    gl.uniformMatrix4fv(modelViewMatrixLocation, false, mvMatrix);


            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else { // no shader program link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)

                //init uniform location
                modelViewMatrixLocation = gl.getUniformLocation(shaderProgram, "uniformModelViewMatrix");
                projectionMatrixLocation = gl.getUniformLocation(shaderProgram, "uniformProjectionMatrix");

                //pase matrix to vertex shader
                gl.uniformMatrix4fv(projectionMatrixLocation, false, pMatrix);
                gl.uniformMatrix4fv(modelViewMatrixLocation, false, mvMatrix);

                vertexPositionAttrib = // get pointer to vertex shader input
                    gl.getAttribLocation(shaderProgram, "vertexPosition");
                gl.enableVertexAttribArray(vertexPositionAttrib); // position input to shader from array

                vertexColorAttrib = // get pointer to vertex shader input
                    gl.getAttribLocation(shaderProgram, "vertexColor");
                gl.enableVertexAttribArray(vertexColorAttrib); // color input to shader from array
            } // end if no shader program link errors
        } // end if no compile errors
    } // end try

    catch (e) {
        console.log(e);
    } // end catch
} // end setup shaders

// render the loaded model
function renderTriangles() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers

    // vertex buffer: activate and feed into vertex shader
    // gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer); // activate
    gl.vertexAttribPointer(vertexPositionAttrib, 3, gl.FLOAT, false, 4 * 6, 0); // feed position
    gl.vertexAttribPointer(vertexColorAttrib, 3, gl.FLOAT, false, 4 * 6, 4 * 3); // feed color

    // triangle buffer: activate and render
    //  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffer); // activate
    gl.drawElements(gl.TRIANGLES, triBufferSize, gl.UNSIGNED_SHORT, 0); // render
    triBufferSize = 0; // the number of indices in the triangle buffer
    vtxBufferSize = 0;
} // end render triangles

// Link: http://learningwebgl.com/blog/?p=1253
// convert ellipsoid to triangles
function loadEllipsoids() {
    var inputEllipsoids = getJSONFile(INPUT_SPHERES_URL, "ellipsoids");
    var lights = getJSONFile(INPUT_LIGHTS_URL, "light");

    function rotateVert() {
        if (e == selectEll) {   //rotate selected object
            ver1 = rotate(ver1, [radiusEllipsoid_X, radiusEllipsoid_Y, radiusEllipsoid_Z], rotMatrix);
            ver2 = rotate(ver2, [radiusEllipsoid_X, radiusEllipsoid_Y, radiusEllipsoid_Z], rotMatrix);
            ver3 = rotate(ver3, [radiusEllipsoid_X, radiusEllipsoid_Y, radiusEllipsoid_Z], rotMatrix);
            ver4 = rotate(ver4, [radiusEllipsoid_X, radiusEllipsoid_Y, radiusEllipsoid_Z], rotMatrix);
        }
    }

    if (inputEllipsoids != String.null) {
        var cX;
        var cY;
        var cZ; // init center x and y coord

        var radiusEllipsoid_X; // init ellipsoid x radius
        var radiusEllipsoid_Y; // init ellipsoid y radius
        var radiusEllipsoid_Z; // init ellipsoid z radius

        var n = inputEllipsoids.length; // the number of input ellipsoids

        ellNum = inputEllipsoids.length;

        var idx = vtxBufferSize;

        for (var e = 0; e < n; e++) {
            cX = inputEllipsoids[e].x; // ellipsoid center x
            cY = inputEllipsoids[e].y; // ellipsoid center y
            cZ = inputEllipsoids[e].z; // ellipsoid center y
            radiusEllipsoid_X = inputEllipsoids[e].a; // x radius
            radiusEllipsoid_Y = inputEllipsoids[e].b; // y radius
            radiusEllipsoid_Z = inputEllipsoids[e].c; // y radius

            // Colors
            var ambient_color = inputEllipsoids[e].ambient;
            var diffuse_color = inputEllipsoids[e].diffuse;
            var specular_color = inputEllipsoids[e].specular;

            var powidx_n = inputEllipsoids[e].n;

            //highlight, translate and change color coe on selected model
            if (e == selectEll) {
                powidx_n += light_n;
                powidx_n %= 21;
                ambient_color = addColor(ambient_color, change_ambient);
                diffuse_color = addColor(diffuse_color, change_diffuse);
                specular_color = addColor(specular_color, change_specular);

                radiusEllipsoid_X *= 1.2;
                radiusEllipsoid_Y *= 1.2;
                radiusEllipsoid_Z *= 1.2;
                cX += xTransform;
                cY += yTransform;
                cZ += zTransform;
            }
            /**
             * To generalise, for a sphere of radius r, with m latitude bands and n longitude bands,
             * we can generate values for x, y, and z by taking a range of values for θ by splitting
             * the range 0 to π up into m parts, and taking a range of values for φ by splitting the range
             * 0 to 2π into n parts, and then just calculating:
             *
             * x = r cosθ
             * y = r sinθ cosφ
             * z = r sinθ sinφ
             *
             */
            for (var arc1 = 0; arc1 < maxYtoX; arc1 = arc1 + 5) {    // arc1 is the angle from y axis to x axis
                for (var arc2 = 0; arc2 < maxYtoZ; arc2 = arc2 + 5) {  // arc2 is the angle from y axis to z axis

                    var ver_x = cX + radiusEllipsoid_X * Math.cos(arc1 * pi / 180);
                    var ver_y = cY + radiusEllipsoid_Y * Math.sin(arc1 * pi / 180) * Math.cos(arc2 * pi / 180);
                    var ver_z = cZ - radiusEllipsoid_Z * Math.sin(arc1 * pi / 180) * Math.sin(arc2 * pi / 180);
                    var ver1 = vec3.fromValues(ver_x, ver_y, ver_z);
                    ver_x = cX + radiusEllipsoid_X * Math.cos(arc1 * pi / 180);
                    ver_y = cY + radiusEllipsoid_Y * Math.sin(arc1 * pi / 180) * Math.cos((arc2 + 5) * pi / 180);
                    ver_z = cZ - radiusEllipsoid_Z * Math.sin(arc1 * pi / 180) * Math.sin((arc2 + 5) * pi / 180);
                    var ver2 = vec3.fromValues(ver_x, ver_y, ver_z);
                    ver_x = cX + radiusEllipsoid_X * Math.cos((arc1 + 5) * pi / 180);
                    ver_y = cY + radiusEllipsoid_Y * Math.sin((arc1 + 5) * pi / 180) * Math.cos(arc2 * pi / 180);
                    ver_z = cZ - radiusEllipsoid_Z * Math.sin((arc1 + 5) * pi / 180) * Math.sin(arc2 * pi / 180);
                    var ver3 = vec3.fromValues(ver_x, ver_y, ver_z);
                    ver_x = cX + radiusEllipsoid_X * Math.cos((arc1 + 5) * pi / 180);
                    ver_y = cY + radiusEllipsoid_Y * Math.sin((arc1 + 5) * pi / 180) * Math.cos((arc2 + 5) * pi / 180);
                    ver_z = cZ - radiusEllipsoid_Z * Math.sin((arc1 + 5) * pi / 180) * Math.sin((arc2 + 5) * pi / 180);
                    var ver4 = vec3.fromValues(ver_x, ver_y, ver_z);
                    rotateVert();

                    var normal = vec3.clone(EclipseNormal(ver1, [cX, cY, cZ],
                        [radiusEllipsoid_X, radiusEllipsoid_Y, radiusEllipsoid_Z]));
                    vec3.normalize(normal, normal);

                    var color = get_lighting(eye, lights, normal, [ver1[0], ver1[1], ver1[2]],
                        ambient_color, diffuse_color, specular_color, powidx_n);

                    //rotate view when press key
                    ver1 = rotate(ver1, lookat, viewMatrix);
                    ver2 = rotate(ver2, lookat, viewMatrix);
                    ver3 = rotate(ver3, lookat, viewMatrix);
                    ver4 = rotate(ver4, lookat, viewMatrix);

                    coordArray.push(ver1[0], ver1[1], ver1[2]);  // push the position to the coordArray
                    coordArray.push(color[0], color[1], color[2]); // push the color to the coordArray

                    normal = vec3.clone(EclipseNormal(ver2, [cX, cY, cZ],
                        [radiusEllipsoid_X, radiusEllipsoid_Y, radiusEllipsoid_Z]));
                    vec3.normalize(normal, normal);

                    color = get_lighting(eye, lights, normal, [ver2[0], ver2[1], ver2[2]],
                        ambient_color, diffuse_color, specular_color, powidx_n);

                    coordArray.push(ver2[0], ver2[1], ver2[2]);
                    coordArray.push(color[0], color[1], color[2]);

                    coordArray.push(ver3[0], ver3[1], ver3[2]);
                    normal = vec3.clone(EclipseNormal(ver3, [cX, cY, cZ],
                        [radiusEllipsoid_X, radiusEllipsoid_Y, radiusEllipsoid_Z]));
                    vec3.normalize(normal, normal);

                    color = get_lighting(eye, lights, normal, [ver3[0], ver3[1], ver3[2]],
                        ambient_color, diffuse_color, specular_color, powidx_n);

                    coordArray.push(color[0], color[1], color[2]);

                    // the color of fourth vertex
                    coordArray.push(ver4[0], ver4[1], ver4[2]);

                    normal = vec3.clone(EclipseNormal(ver4, [cX, cY, cZ],
                        [radiusEllipsoid_X, radiusEllipsoid_Y, radiusEllipsoid_Z]));
                    vec3.normalize(normal, normal);

                    color = get_lighting(eye, lights, normal, [ver4[0], ver4[1], ver4[2]],
                        ambient_color, diffuse_color, specular_color, powidx_n);

                    coordArray.push(color[0], color[1], color[2]);

                    indexArray.push(idx, idx + 1, idx + 2);
                    indexArray.push(idx + 1, idx + 2, idx + 3);

                    triBufferSize = triBufferSize + 6;
                    vtxBufferSize += 4;
                    idx = idx + 4;
                }
            }
        }
    }

    // send the vertex coords to webGL
    vertexBuffer = gl.createBuffer(); // init empty vertex coord buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer); // activate that buffer
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(coordArray), gl.STATIC_DRAW); // coords to that buffer

    // send the triangle indices to webGL
    triangleBuffer = gl.createBuffer(); // init empty triangle index buffer
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffer); // activate that buffer
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indexArray), gl.STATIC_DRAW); // indices to that buffer

}

function EclipseNormal(coord, center, radius) {
    var x = (coord[0] * 2 - center[0] * 2) / radius[0] / radius[0];
    var y = (coord[1] * 2 - center[1] * 2) / radius[1] / radius[1];
    var z = (coord[2] * 2 - center[2] * 2) / radius[2] / radius[2];
    return [x, y, z];
}

/* interactively change view, lighting and transform*/
document.addEventListener('keyup', function (event) {
    // console.log("execution:"+event.code);
    if (event.shiftKey) {  //Upper case with shift
        switch (event.code) {
            case "KeyK":
                rotMatrix = getRotateMatrix(-30, rotMatrix, "y");
                break;
            case "Semicolon":
                rotMatrix = getRotateMatrix(30, rotMatrix, "y");
                break;
            case "KeyO":
                rotMatrix = getRotateMatrix(30, rotMatrix, "x");
                break;
            case "KeyL":
                rotMatrix = getRotateMatrix(-30, rotMatrix, "x");
                break;
            case "KeyI":
                rotMatrix = getRotateMatrix(30, rotMatrix, "z");
                break;
            case "KeyP":
                rotMatrix = getRotateMatrix(-30, rotMatrix, "z");
                break;
            case "KeyA":
                viewMatrix = getRotateMatrix(-30, viewMatrix, "y");
                break;
            case "KeyD":
                viewMatrix = getRotateMatrix(30, viewMatrix, "y");
                break;
            case "KeyW":
                viewMatrix = getRotateMatrix(-30, viewMatrix, "x");
                break;
            case "KeyS":
                viewMatrix = getRotateMatrix(30, viewMatrix, "x");
                break;
        }
    }
    else {
        switch (event.code) {
            case "KeyQ":
                vec3.add(Eye, Eye, [0, -0.1, 0]);
                // vec3.add(at,at,[0,-0.1,0]);
                break;
            case "KeyE":
                vec3.add(Eye, Eye, [0, 0.1, 0]);
                // vec3.add(at,at,[0,0.1,0]);
                break;
            case "KeyA":
                vec3.add(Eye, Eye, [0.1, 0, 0]);
                // vec3.add(at,at,[0.1,0,0]);
                break;
            case "KeyD":
                vec3.add(Eye, Eye, [-0.1, 0, 0]);
                // vec3.add(at,at,[-0.1,0,0]);
                break;
            case "KeyW":
                vec3.add(Eye, Eye, [0, 0, 0.1]);
                // vec3.add(at,at,[0,0,0.1]);
                break;
            case "KeyS":
                vec3.add(Eye, Eye, [0, 0, -0.1]);
                // vec3.add(at,at,[0,0,-0.1]);
                break;
            case "ArrowLeft":
                if (triNum > 0) {
                    selectTri = selectPrevious(selectTri, triNum);
                    selectEll = -1;
                }
                break;
            case "ArrowRight":
                if (triNum > 0) {
                    selectTri = selectNext(selectTri, triNum);
                    selectEll = -1;
                }
                break;
            case "ArrowDown":
                if (ellNum > 0) {
                    selectEll = selectPrevious(selectEll, ellNum);
                    selectTri = -1;
                }
                break;
            case "ArrowUp":
                if (ellNum > 0) {
                    selectEll = selectNext(selectEll, ellNum);
                    selectTri = -1;
                }
                break;
            case "Space":
                // changeSelect();
                light_choice = 0;
                light_n = 0;
                change_ambient = 0;
                change_diffuse = 0;
                change_specular = 0;
                xTransform = 0;
                yTransform = 0;
                zTransform = 0;
                rotMatrix = mat4.create();
                selectTri = -1;
                selectEll = -1;
                break;
            case "KeyB":
                light_choice += 1;
                light_choice %= 2;
                break;
            case "KeyN":
                light_n += 1;
                break;
            case "Digit1":
                change_ambient += 0.1;
                break;
            case "Digit2":
                change_diffuse += 0.1;
                break;
            case "Digit3":
                change_specular += 0.1;
                break;
            case "KeyK":
                xTransform += 0.1;
                break;
            case "Semicolon":
                xTransform -= 0.1;
                break;
            case "KeyO":
                zTransform += 0.1;
                break;
            case "KeyL":
                zTransform -= 0.1;
                break;
            case "KeyI":
                yTransform += 0.1;
                break;
            case "KeyP":
                yTransform -= 0.1;
                break;
            default:
                break;
        }
    }
    // clear previous operation
    gl = null;
    triBufferSize = 0;
    vtxBufferSize = 0;
    eye = new vec3.fromValues(0.5, 0.5, -0.5);

    coordArray = [];
    indexArray = [];
    main();
});

// Scale Object
function scale(vtxs, center, coe) {
    var vtx = new vec3.fromValues(vtxs[0], vtxs[1], vtxs[2]);
    vec3.subtract(vtx, vtx, center);
    vec3.scaleAndAdd(vtx, center, vtx, coe);
    return vtx;
}

// Translate object
function translate(vtxs, x, y, z) {
    var vtx = new vec3.fromValues(vtxs[0], vtxs[1], vtxs[2]);
    var tranM = mat4.fromValues(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1);
    vec3.transformMat4(vtx, vtx, tranM);
    return vtx;
}

// Rotate object or view
function rotate(vtxs, center, matrix) {
    var vtx = new vec3.fromValues(vtxs[0], vtxs[1], vtxs[2]);
    vec3.subtract(vtx, vtx, center);
    vec3.transformMat4(vtx, vtx, matrix);
    vec3.add(vtx, vtx, center);
    return vtx;
}

// change color
function addColor(color, add) {
    color[0] = Math.round((color[0] + add) * 10);
    color[1] = Math.round((color[1] + add) * 10);
    color[2] = Math.round((color[2] + add) * 10);
    color[0] = color[0] % 11 / 10;
    color[1] = color[1] % 11 / 10;
    color[2] = color[2] % 11 / 10;
    return color;
}

function lighting(eye, light, normal, vertex, color_ambient, color_diffuse, color_specular, n) {
    var color = [color_ambient[0] * light[0].ambient[0],
        color_ambient[1] * light[0].ambient[1],
        color_ambient[2] * light[0].ambient[2]
    ];
    for (var lightIndex = 0; lightIndex < light.length; lightIndex++) {    //multiple lights
        lightSource = light[lightIndex];
        var la = lightSource.ambient;
        var ld = lightSource.diffuse;
        var ls = lightSource.specular;

        // console.log(ka,kd,ks,n);
        var lightPos = vec3.fromValues(lightSource.x, lightSource.y, lightSource.z);

        var vecL = vec3.create();
        vec3.subtract(vecL, lightPos, vertex);
        vec3.normalize(vecL, vecL);

        var vecE = vec3.create();
        vec3.subtract(vecE, eye, vertex);
        vec3.normalize(vecE, vecE);

        var vecH = vec3.create();
        vec3.add(vecH, vecE, vecL);
        vec3.normalize(vecH, vecH);

        vec3.normalize(vecL, vecL);
        var nl = vec3.dot(normal, vecL);
        var nh = vec3.dot(normal, vecH);

        color[0] += color_diffuse[0] * ld[0] * nl + color_specular[0] * ls[0] * Math.pow(nh, n);
        color[1] += color_diffuse[1] * ld[1] * nl + color_specular[1] * ls[1] * Math.pow(nh, n);
        color[2] += color_diffuse[2] * ld[2] * nl + color_specular[2] * ls[2] * Math.pow(nh, n);
    }

    return color;
}

function lighting_phong(eye, light, normal, vertex, color_ambient, color_diffuse, color_specular, n) {
    var color = [color_ambient[0] * light[0].ambient[0],
        color_ambient[1] * light[0].ambient[1],
        color_ambient[2] * light[0].ambient[2]
    ];      //ambient
    for (var lightIndex = 0; lightIndex < light.length; lightIndex++) {
        lightSource = light[lightIndex];
        var la = lightSource.ambient;
        var ld = lightSource.diffuse;
        var ls = lightSource.specular;

        // console.log(ka,kd,ks,n);
        var lightPos = vec3.fromValues(lightSource.x, lightSource.y, lightSource.z);

        var lvec = vec3.create();
        vec3.subtract(lvec, lightPos, vertex);   // light direction
        vec3.normalize(lvec, lvec);

        var evec = vec3.create();
        vec3.subtract(evec, eye, vertex);  // the view vector
        vec3.normalize(evec, evec);

        var hvec = vec3.create();
        vec3.add(hvec, evec, lvec);
        vec3.normalize(hvec, hvec);

        vec3.normalize(lvec, lvec);
        var nl = Math.max(vec3.dot(normal, lvec), 0);

        var refc = vec3.create();
        vec3.scale(refc, normal, 2 * vec3.dot(lvec, normal));
        vec3.subtract(refc, refc, lvec);
        var nh = Math.max(vec3.dot(refc, evec), 0);

        color[0] += color_diffuse[0] * ld[0] * nl + color_specular[0] * ls[0] * Math.pow(nh, n);
        color[1] += color_diffuse[1] * ld[1] * nl + color_specular[1] * ls[1] * Math.pow(nh, n);
        color[2] += color_diffuse[2] * ld[2] * nl + color_specular[2] * ls[2] * Math.pow(nh, n);
        // console.log("light"+lightIndex+": "+color);
    }

    return color;

}

function get_lighting(eye, light, normal, vertex, color_ambient, color_diffuse, color_specular, n) {
    if (light_choice == 0) {
        return lighting(eye, light, normal, vertex, color_ambient, color_diffuse, color_specular, n);
    }
    else {
        return lighting_phong(eye, light, normal, vertex, color_ambient, color_diffuse, color_specular, n);
    }
}

// Helper method to rotate the matrix
function getRotateMatrix(degAngle, mat, axis) {
    var radAngle = degAngle * Math.PI / 180;
    switch (axis) {
        case "x":
            rotMat = mat4.rotateX(mat, mat, radAngle);
            break;
        case "y":
            rotMat = mat4.rotateY(mat, mat, radAngle);
            break;
        case "z":
            rotMat = mat4.rotateZ(mat, mat, radAngle);
            break;
        default:
            break;
    }
    return mat;
}

// change selected model
function selectNext(index, num) {    //change selected object to next
    if (index < num - 1) index += 1;
    else index = 0;
    light_choice = 0;
    light_n = 0;
    change_ambient = 0;
    change_diffuse = 0;
    change_specular = 0;
    xTransform = 0;
    yTransform = 0;
    zTransform = 0;
    rotMatrix = mat4.create();
    return index;
}

function selectPrevious(index, num) {    //change selected object to previous
    if (index <= 0) index = num - 1;
    else index -= 1;
    light_choice = 0;
    light_n = 0;
    change_ambient = 0;
    change_diffuse = 0;
    change_specular = 0;
    xTransform = 0;
    yTransform = 0;
    zTransform = 0;
    rotMatrix = mat4.create();
    return index;
}

/* MAIN -- HERE is where execution begins after window load */
function main() {

    setupWebGL(); // set up the webGL environment
    loadTriangles(); // load in the triangles from tri file
    loadEllipsoids();   //load ellipsoid file and convert to tri file
    setupShaders(); // setup the webGL shaders
    renderTriangles(); // draw the triangles using webGL

} // end main
