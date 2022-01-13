var rooms = new Array();
var inventory = new Object();

var floorWidth = 100;
var floorHeight = 100; // Max X and Y of floor

class Room {
    constructor(name, hsv) {
        this.name = name;
        this.hsv = hsv;
    }
}

Number.prototype.mod = function(n) {
    return ((this%n)+n)%n;
};

var generateBtn = document.getElementById('generate-btn'),
    gameTable = document.getElementById('game-table');

generateBtn.addEventListener('click', function() {
    generateRooms(10000);
});

function generateRooms(maxRoomCount) {
    rooms = new Array();
    visitedCoords = new Array();
    for(let y = 0; y < floorHeight; y++) {
        rooms.push(new Array());
        for(let x = 0; x < floorHeight; x++) {
            rooms[y].push(null);
        }
    }

    var walker = { "x":Math.round(floorWidth/2), "y":Math.round(floorHeight/2), "dir":0 };
    walker.dir = Math.floor(Math.random() * 4);

    for (let i = 0; i < maxRoomCount; i++) {
        var possibleDirections = new Array();
        var forwardPossible = false;
        for (let dir = 0; dir < 4; dir++) {
            testCoords = moveInDirection(walker.x, walker.y, dir);
            testCoords.dirMoved = dir;

            if(testCoords != false && rooms[testCoords.y][testCoords.x] == null) {
                if (dir == walker.dir) {
                    forwardPossible = true;
                    possibleDirections.splice(0, 0, testCoords);
                }
                else {
                    possibleDirections.push(testCoords);
                }
            }
        }
        
        if(possibleDirections.length > 0) {
            var randIndex = Math.floor(Math.random() * possibleDirections.length);
            if(forwardPossible && Math.random() > 0.3) randIndex = 0;
            nextCoords = possibleDirections[randIndex];
            var hsv = {
                h: i*5,
                s: 100,
                v: 80
            };
            rooms[nextCoords.y][nextCoords.x] = new Room("A room", hsv);
            walker.x = nextCoords.x;
            walker.y = nextCoords.y;
            walker.dir = nextCoords.dirMoved;
            visitedCoords.push(nextCoords);
        }
        else {
            randCoords = visitedCoords[Math.floor(Math.random() * visitedCoords.length)];
            walker.x = randCoords.x;
            walker.y = randCoords.y;
        }
    }
    renderTable();
}

// var intervalId = window.setInterval(function(){
//     renderTable();
//   }, 1000/60);

function renderTable() {
    rooms.forEach(row => {
        row.forEach(room => {
            if(room !== null) room.hsv.h += 5;
        });
    });
    for (let y = 0; y < gameTable.childElementCount; y++) {
        for (let x = 0; x < gameTable.childNodes[y].childElementCount; x++) {
            if (rooms[y][x] != null) {
                rooms[y][x].hsv.h += 5;
                var hsvColor = Color( rooms[y][x].hsv );
                gameTable.childNodes[y].childNodes[x].style.backgroundColor = hsvColor.toString();
            }
            else {
                gameTable.childNodes[y].childNodes[x].style.backgroundColor = "#1F1E33";
            }
        }
    }
}

generateTable();

function generateTable(){
    for (let y = 0; y < floorHeight; y++) {
        var tr = document.createElement('tr');
        for (let x = 0; x < floorWidth; x++) {
            var td = document.createElement('td');
            td.style.backgroundColor = "yellow";
            tr.appendChild(td);
        }
        gameTable.appendChild(tr);
    }
}

function coordsToIndex(x, y) {
    if(x>=floorWidth||x<0||y>=floorHeight||y<0) {
        // console.log("Coords outside floor!");
        return false;
    }
    return y * floorWidth + x;
}

function indexToCoords(index) {
    var coords = new Object();
    coords.y = Math.floor(index/floorWidth);
    coords.x = index.mod(floorWidth);
    return coords;
}

function testIfCoordsValid(x, y) {
    return !(x>=floorWidth||x<0||y>=floorHeight||y<0);
}

function testIfIndexValid(index) {
    var coords = indexToCoords(index);
    return testIfCoordsValid(coords.x, coords.y);
}

function moveInDirection(x, y, dir) {
    switch(dir){
        case 0:
            y += 1;
            break;
        case 1:
            x += 1;
            break;
        case 2:
            y -= 1;
            break;
        case 3:
            x -= 1;
            break;
        default:
            console.log("dir was out of range 0-3");
            break;
    }
    coords = new Object();
    coords.x = x;
    coords.y = y;
    return testIfCoordsValid(x, y) ? coords : false;
}