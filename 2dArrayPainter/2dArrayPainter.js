var brushInput = document.getElementById("brushInput");
var xinput = document.getElementById("xinput");
var yinput = document.getElementById("yinput");
var canvas = document.getElementById("canvas");
var output = document.getElementById("output");
var brushContainer = document.getElementById("brush-container");
var brushInputTemplate = document.getElementById("brush-info-template");
var newBrushBtn = document.getElementById("new-brush");

var theArray = [];

var colors = ["black", "red", "green", "blue", "orange"];

var brushes = [];
var selectedBrush = -1;

class Brush {
    constructor(value, color, index) {
      this.value = value;
      this.color = color;
      this.index = index;
    }
}

var mouseDown = false;

function init() {
    canvas.onmousedown = function() { mouseDown = true; };
    document.onmouseup = function() { mouseDown = false; };

    newBrushBtn.onclick = function() { newColorInput(); };
    newColorInput();
    setSelectedBrush(0);

    refreshCanvasSize();
    refreshCanvas();
}

function newColorInput() {
    var clone = brushInputTemplate.content.cloneNode(true);
    brushContainer.appendChild(clone);
    var newBrush = brushContainer.getElementsByClassName("brush-info")[brushes.length];
    var colInput = newBrush.getElementsByClassName("brush-color")[0];
    var valInput = newBrush.getElementsByClassName("brush-value")[0];

    colInput.value = '#'+(Math.random()*0xFFFFFF<<0).toString(16);
    valInput.value = brushes.length;

    colInput.onchange = (function() { 
        var index = brushes.length;
        return function () {
            setBrushColor(index, colInput.value);
        }
    })();

    valInput.onchange = (function() { 
        var index = brushes.length;
        return function () {
            setBrushValue(index, valInput.value);
        }
    })();

    newBrush.onclick = (function() { 
        var index = brushes.length;
        return function () {
            setSelectedBrush(index);
        }
    })();

    brushes.push(new Brush(valInput.value, colInput.value, brushes.length));
}

function setBrushColor(brushIndex, color) {
    brushes[brushIndex].color = color;
    refreshCanvas();
}

function setBrushValue(brushIndex, value) {
    brushes[brushIndex].value = value;
    buildOutputString();
}

function setSelectedBrush(index) {
    if(selectedBrush != -1) brushContainer.getElementsByClassName("brush-info")[selectedBrush].classList.toggle("selected");
    selectedBrush = index;
    brushContainer.getElementsByClassName("brush-info")[selectedBrush].classList.toggle("selected");
}

function refreshCanvasSize() {
    var targetY = yinput.value;
    var targetX = xinput.value;
    var currentY = canvas.rows.length;

    while(targetY > theArray.length) {
        theArray.push([0]);
    }

    theArray.forEach(element => {
        while(targetX > element.length) {
            element.push(0);
        }
    });

    while(currentY > targetY) {
        canvas.deleteRow(canvas.rows.length - 1);
        currentY--;
    }
    while(currentY < targetY) {
        canvas.insertRow(canvas.rows.length);
        currentY++;
    }

    for (let y = 0; y < canvas.rows.length; y++) {
        const row = canvas.rows[y];
        
        var currentX = row.cells.length;

        while(currentX > targetX) {
            row.deleteCell(row.cells.length - 1);
            currentX--;
        }
        while(currentX < targetX) {
            row.insertCell(row.cells.length);
            var hoverFunc = (function() { 
                var xIn = currentX;
                var yIn = y;
                var btn = row.cells[row.cells.length - 1];
                return function () {
                    canvasButtonHovered(btn, xIn, yIn);
                }})();
            var clickFunc = (function() { 
                var xIn = currentX;
                var yIn = y;
                var btn = row.cells[row.cells.length - 1];
                return function () {
                    canvasButtonClicked(btn, xIn, yIn);
                }})();
            row.cells[row.cells.length - 1].onmouseenter = hoverFunc;
            row.cells[row.cells.length - 1].onmousedown = clickFunc;
            row.cells[row.cells.length - 1].style.backgroundColor = brushes[theArray[y][currentX]].color;
            currentX++;
        }
    }

    buildOutputString();
}

function refreshCanvas() {
    for (let y = 0; y < canvas.rows.length; y++) {
        const row = canvas.rows[y];
        for (let x = 0; x < row.cells.length; x++) {
            const cell = row.cells[x];
            cell.style.backgroundColor = brushes[theArray[y][x]].color;
        }
    }
}

function canvasButtonHovered(btn, x, y) {
    if(mouseDown) {
        canvasButtonClicked(btn, x, y);
    }
}

function canvasButtonClicked(btn, x, y) {
    theArray[y][x] = selectedBrush;
    btn.style.backgroundColor = brushes[selectedBrush].color;
    buildOutputString();
}

function buildOutputString() {
    var targetY = yinput.value;
    var targetX = xinput.value;
    
    var string = "{\n";

    for (let y = 0; y < targetY; y++) {
        const row = theArray[y];
        string += " { ";
        for (let x = 0; x < targetX; x++) {
            const brush = row[x];
            string += brushes[brush].value + ", ";
        }
        string = string.slice(0, -2)
        string += " },\n ";
    }

    string = string.slice(0, -3)
    string += "}";
    
    output.innerText = string;
}