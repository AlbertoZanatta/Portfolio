window.onload = function () {
    setButton();
    setSliders();
    init();
}

//Global gl and program variables
var gl = null;
var program = null;

//Array of vertices for the reflective sphere
var vertices = [];

//Angle for the rotating camera around the sphere and corresponding boolean value
var theta = 0;
var moveCamera = false;

//Array of orientations for the six faces of the cubeMaps
var cubemapOrientations;

//Landscape cube map
var cubemap1 = [
'textures/cubemap1/cm_left.png', // POSITIVE_X
'textures/cubemap1/cm_right.png', // NEGATIVE_X
'textures/cubemap1/cm_top.png', // POSITIVE_Y
'textures/cubemap1/cm_bottom.png', // NEGATIVE_Y
'textures/cubemap1/cm_back.png', // POSITIVE_Z
'textures/cubemap1/cm_front.png' // NEGATIVE_Z
];

//Courtyard cube map
var cubemap2 = [
'textures/cubemap2/cm_left.png', // POSITIVE_X
'textures/cubemap2/cm_right.png', // NEGATIVE_X
'textures/cubemap2/cm_top.png', // POSITIVE_Y
'textures/cubemap2/cm_bottom.png', // NEGATIVE_Y
'textures/cubemap2/cm_back.png', // POSITIVE_Z
'textures/cubemap2/cm_front.png' // NEGATIVE_Z
];

//Array of cubemap sources
var cubeMapSources = [
    cubemap1,
    cubemap2
];

//Array of cubeMaps
var cubeMaps = [];

//Coordinates of the background quad
var quadVertices = [
    vec4(-1.0, -1.0, 0.999, 1.0),
    vec4(1.0, -1.0, 0.999, 1.0),
    vec4(1.0, 1.0, 0.999, 1.0),
    vec4(-1.0, -1.0, 0.999, 1.0),
    vec4(1.0, 1.0, 0.999, 1.0),
    vec4(-1.0, 1.0, 0.999, 1.0)
];

//Current cubeMap index
var currentCubeMap = 0;

//Array of the different texture units used for texture binding
var textureUnits = [];
//Current number of texture units used
var currentTextureUnit = 0;

//Fixed projection matrix
var projectionMatrix;

//Global sphere and quad objects
var sphere;
var quad;

function init()
{
    var canvas = document.getElementById("canv");
    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl)
    {
        alert("WebGL isn’t available");
    }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.3921, 0.5843, 0.9294, 1.0);

    //Enable depth test and face culling
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);

    //Load shaders 
    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    //Initial values for drawing the sphere using recursive subdivision
    var numTimesToSubdivide = 5;
    var va = vec4(0.0, 0.0, 1.0, 1);
    var vb = vec4(0.0, 0.942809, -0.333333, 1);
    var vc = vec4(-0.816497, -0.471405, -0.333333, 1);
    var vd = vec4(0.816497, -0.471405, -0.333333, 1);

    //Calculate the vertices of the sphere using recursive subdivision
    tetrahedron(va, vb, vc, vd, numTimesToSubdivide);

    //Create the reflective sphere object
    sphere = new Object();
    sphere.vertexBuffer = initArrayBufferForLaterUse(gl, flatten(vertices), 4, gl.FLOAT);
    
    //Create the screen-filling quad object
    quad = new Object();
    quad.vertexBuffer = initArrayBufferForLaterUse(gl, flatten(quadVertices), 4, gl.FLOAT);

    //Initialize and load the cube maps

    //Assign values to the texture units array
    textureUnits = [
        gl.TEXTURE0,
        gl.TEXTURE1,
        gl.TEXTURE2,
        gl.TEXTURE3,
        gl.TEXTURE4,
        gl.TEXTURE5,
        gl.TEXTURE6,
        gl.TEXTURE7
    ];

    //Assign values to the orientations array
    cubemapOrientations = [
    gl.TEXTURE_CUBE_MAP_POSITIVE_X,
    gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
    gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
    gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
    gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
    gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
    ];

    //Create and correctly initialize the cubemap textures
    for (var i = 0; i < cubeMapSources.length && currentTextureUnit < textureUnits.length; i++) {
        cubeMaps.push(loadCubemap(cubeMapSources[i], currentTextureUnit));
        currentTextureUnit++;
    }

    //Initialize the fixed projection matrix for visualizing the sphere
    projectionMatrix = mat4();
    var fovy = 90;
    var aspectRatio = 1;
    var near = 0.001;
    var far = 5;
    projectionMatrix = perspective(fovy, aspectRatio, near, far);

    render(); 
}

function render()
{
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    for (var i = 0; i < cubeMaps.length; i++) {
        if (!cubeMaps[i].finishedLoading) {
            requestAnimationFrame(render);
            return;
        }
    }

    //Bind the current cubeMap
    gl.uniform1i(gl.getUniformLocation(program, "cubeMap"), cubeMaps[currentCubeMap].textureunit);

    //Draw the reflective sphere:
    //Bind the vertex positions of the sphere
    initAttributeVariable(gl, gl.getAttribLocation(program, 'vPosition'), sphere.vertexBuffer);

    //Set the modelView and projection matrices for the sphere
    var modelViewMatrix = mat4();
    eye = vec3(2 * Math.cos(theta), 0.0, 2 * Math.sin(theta));
    at = vec3(0.0, 0.0, 0.0);
    up = vec3(0.0, 1.0, 0.0);
    modelViewMatrix = mult(modelViewMatrix, lookAt(eye, at, up));
    gl.uniformMatrix4fv(gl.getUniformLocation(program, "modelViewMatrix"), false, flatten(modelViewMatrix));
    gl.uniformMatrix4fv(projectionMatrixLoc = gl.getUniformLocation(program, "projectionMatrix"), false, flatten(projectionMatrix));

    //For the sphere the mTex matrix is the same as the identity matrix
    gl.uniformMatrix4fv(gl.getUniformLocation(program, "mTex"), false, flatten(mat4()));

    //Bind and set the other uniform variables: eye position and reflective boolean 
    gl.uniform1i(gl.getUniformLocation(program, "reflective"), 1);
    gl.uniform3fv(gl.getUniformLocation(program, "eye"), eye);

    //Draw the sphere on screen
    gl.drawArrays(gl.TRIANGLES, 0, vertices.length);

    //Draw the screen-filling quad:
    //Bind the vertex positions of the quad
    initAttributeVariable(gl, gl.getAttribLocation(program, 'vPosition'), quad.vertexBuffer);

    //For the quad both the modelViewMatrix and the projectionMatrix correspond to the identity
    gl.uniformMatrix4fv(projectionMatrixLoc = gl.getUniformLocation(program, "projectionMatrix"), false, flatten(mat4()));
    gl.uniformMatrix4fv(gl.getUniformLocation(program, "modelViewMatrix"), false, flatten(mat4()));

    //Calculate the mTex matrix for the screen-filling quad.
    //A: inverse of the projection matrix (in order to go from clip coordinates to camera coordinates)
    var projectionInverse = inverse4(projectionMatrix);

    //B: inverse of the rotational part of the view matrix
    //B.1 : calculate the rotational part of the view matrix
    var v = normalize(subtract(at, eye));  
    var n = normalize(cross(v, up));       
    var u = normalize(cross(n, v));        

    v = negate(v);

    var rotationalPart = mat4(
        vec4(n, 0.0),
        vec4(u, 0.0),
        vec4(v, 0.0),
        vec4(0.0, 0.0, 0.0, 1.0)
    );
    //B.2 : calculate the inverse of such matrix
    var rotationInverse = inverse4(rotationalPart)

    //C: multiply the two matrices
    var mTex = mult(rotationInverse, projectionInverse);

    //Bind the mTex matrix
    gl.uniformMatrix4fv(gl.getUniformLocation(program, "mTex"), false, flatten(mTex));

    //Set the reflective boolean uniform variable to false
    gl.uniform1i(gl.getUniformLocation(program, "reflective"), 0);

    //Draw the quad on screen
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    if (moveCamera) {
        theta += 0.01;
        requestAnimationFrame(render);
    }
}

//helper functions to draw the 1 unit sphere
function tetrahedron(a, b, c, d, n)
{
    divideTriangle(a, b, c, n);
    divideTriangle(d, c, b, n);
    divideTriangle(a, d, b, n);
    divideTriangle(a, c, d, n);
}

function divideTriangle(a, b, c, count)
{
    if (count > 0)
    {
        var ab = normalize(mix(a, b, 0.5), true);
        var ac = normalize(mix(a, c, 0.5), true);
        var bc = normalize(mix(b, c, 0.5), true);

        divideTriangle(a, ab, ac, count - 1);
        divideTriangle(ab, b, bc, count - 1);
        divideTriangle(bc, c, ac, count - 1);
        divideTriangle(ab, bc, ac, count - 1);
    }
    else
    {
        triangle(a, b, c);
    }
}

function triangle(a, b, c)
{
    vertices.push(a);
    vertices.push(b);
    vertices.push(c);
}

function initArrayBufferForLaterUse(gl, data, num, type) {
    // Create a buffer object
    var buffer = gl.createBuffer();
    if (!buffer) {
        console.log('Failed to create the buffer object');
        return null;
    }
    // Write date into the buffer object
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

    // Store the necessary information to assign the object to the attribute variable later
    buffer.num = num;
    buffer.type = type;

    return buffer;
}

function initAttributeVariable(gl, a_attribute, buffer) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(a_attribute, buffer.num, buffer.type, false, 0, 0);
    gl.enableVertexAttribArray(a_attribute);
}

function loadCubemap(cubemapFaces, textureUnit) {
    var cubeMap = gl.createTexture();
    gl.activeTexture(textureUnits[textureUnit]);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeMap);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

    cubeMap.loaded = 0;
    cubeMap.finishedLoading = false;
    cubeMap.textureunit = textureUnit;


    for (var i = 0; i < 6; i++) {
        var image = document.createElement('img');
        image.numImage = i;
        image.cubemap = cubeMap;

        image.crossorigin = 'anonymous';

        image.onload = function (event) {
            var image = event.target;
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.activeTexture(textureUnits[image.cubemap.textureunit]);
            gl.texImage2D(cubemapOrientations[image.numImage], 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            image.cubemap.loaded++;
            if (image.cubemap.loaded == 6) {
                image.cubemap.finishedLoading = true;
            }

        }

        image.src = cubemapFaces[i];
    }

    return cubeMap;

}

function setButton() {
    document.getElementById("move_cam").onclick = function () {
        if (!moveCamera) {
            moveCamera = true;
            document.getElementById("move_cam").innerHTML = "Stop camera";
            render();
        }
        else if (moveCamera) {
            moveCamera = false;
            document.getElementById("move_cam").innerHTML = "Move camera";
        }

    }
}

function setSliders() {
    var cbm = document.getElementById("cubemap_menu");
    cbm.addEventListener("click", function () {
        currentCubeMap = cbm.selectedIndex;
        console.log("index: " + cbm.selectedIndex);
        if (!moveCamera) {
            render();
        }
    });

}

