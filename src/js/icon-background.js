document.addEventListener("DOMContentLoaded", function(){
    


// module aliases
var Engine = Matter.Engine,
    Render = Matter.Render,
    Runner = Matter.Runner,
    Body = Matter.Body,
    Bodies = Matter.Bodies,
    Bounds = Matter.Bounds,
    Composite = Matter.Composite,
    Mouse = Matter.Mouse,
    Events = Matter.Events,
    MouseConstraint = Matter.MouseConstraint;

// create an engine
var engine = Engine.create();

var background = document.getElementById("icon-background");

// create a renderer
var render = Render.create({
    element: background,
    engine: engine,
    options: {
        width: background.getBoundingClientRect().width,
        height: background.getBoundingClientRect().height,
        pixelRatio: 1,
        background: '#111827',
        wireframeBackground: '#222',
        hasBounds: false,
        enabled: true,
        wireframes: false,
        showSleeping: true,
        showDebug: false,
        showBroadphase: false,
        showBounds: false,
        showVelocity: false,
        showCollisions: false,
        showSeparations: false,
        showAxes: false,
        showPositions: false,
        showAngleIndicator: false,
        showIds: false,
        showShadows: false,
        showVertexNumbers: false,
        showConvexHulls: false,
        showInternalEdges: false,
        showMousePosition: false
    }
});

const icons = [
    {
        texture: '/src/resources/background-icons/unity.png',
        scale: 0.3,
        count: 1,
        radius: 40
    },
    {
        texture: '/src/resources/background-icons/star.png',
        scale: 0.15,
        count: 10,
        radius: 20
    },
    {
        texture: '/src/resources/background-icons/blender.png',
        scale: 0.3,
        count: 1,
        radius: 40
    },
    {
        texture: '/src/resources/background-icons/csharp.png',
        scale: 0.24,
        count: 1,
        radius: 40
    },
    {
        texture: '/src/resources/background-icons/java.png',
        scale: 0.3,
        count: 1,
        radius: 40
    }
]

let iconBodies = [];

icons.forEach(icon => {
    for (let i = 0; i < icon.count; i++) {
        var newIcon = Bodies.circle(
            (Math.random() * 0.8 + 0.1) * background.getBoundingClientRect().width,
            (Math.random() * 0.5 + 0.1) * background.getBoundingClientRect().height,
            icon.radius, 
            { 
            frictionAir: 0.01,
            render: {
                sprite: {
                    texture: icon.texture,
                    xScale: icon.scale,
                    yScale: icon.scale
                }
            } 
        });
        iconBodies.push(newIcon);
    }
});

// create two boxes and a ground
// var boxA = Bodies.rectangle(400, 200, 80, 80, { 
//     frictionAir: 0.03,
//     render: {
//     sprite: {
//       texture: '/src/resources/background-icons/unity.png',
//       xScale: 0.3,
//       yScale: 0.3
//     }
//   } });
// var boxB = Bodies.rectangle(450, 50, 80, 80, { frictionAir: 0.03 });
// var ground = Bodies.rectangle(400, 610, 810, 60, { isStatic: true });

// add all of the bodies to the world
Composite.add(engine.world, iconBodies);

// add mouse control
var mouse = Mouse.create(render.canvas),
mouseConstraint = MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: {
        stiffness: 0.2,
        render: {
            visible: false
        }
    }
});

mouseConstraint.mouse.element.removeEventListener("mousewheel", mouseConstraint.mouse.mousewheel);
mouseConstraint.mouse.element.removeEventListener("DOMMouseScroll", mouseConstraint.mouse.mousewheel);

// var lastScrollTop = 0;
// let lastKnownScrollPosition = 0;
// let ticking = false;
// let scrolling = false;
// var timer = null;

// document.addEventListener('scroll', function(e) {
//     lastKnownScrollPosition = window.scrollY;
  
//     if (!ticking && !scrolling) {
//       window.requestAnimationFrame(function() {
//         var st = window.pageYOffset || document.documentElement.scrollTop; // Credits: "https://github.com/qeremy/so/blob/master/so.dom.js#L426"
//         if (st > lastScrollTop){
//             // downscroll code
//         } else {
//             if(window.scrollY < window.innerHeight * 3/4) {
//                 window.scrollTo({
//                     top: 0,
//                     left: 0,
//                     behavior: 'smooth'
//                 });
//                 console.log("ding");
//             }
//         }
//         lastScrollTop = st <= 0 ? 0 : st; // For Mobile or negative scrolling
//         ticking = false;
//         scrolling = true;
//         if(timer !== null) {
//             clearTimeout(timer);        
//         }
//         timer = setTimeout(function() {
//               scrolling = false;
//         }, 550);
//       });
  
//       ticking = true;
//     }
//   });

// https://stackoverflow.com/questions/57169055/prevent-scroll-on-bodies-matter-js

// let touchStart;
// mouseConstraint.mouse.element.addEventListener('touchstart', (event) => {
//   if (!mouseConstraint.body) {
//     touchStart = event;
//   }
// });

// mouseConstraint.mouse.element.addEventListener('touchend', (event) => {
//   if (!mouseConstraint.body) {
//     const startY = touchStart.changedTouches[0].clientY;
//     const endY = event.changedTouches[0].clientY;
//     const delta = Math.abs(startY - endY);

//     if (delta > 80) {
//       window.scrollTo(0, 600);
//     }
//   }
// });

Composite.add(engine.world, mouseConstraint);

// keep the mouse in sync with rendering
render.mouse = mouse;

var worldBounds = Bounds.create()

const minHeightBuffer = 100;

function hasBodyEscaped(body) {
    var x = body.position.x;
    var y = body.position.y;

    return x < 0 || x > render.canvas.width || y < 0 || y > render.canvas.height - minHeightBuffer;
}

function getReturnForce(body) {
    var x = body.position.x;
    var y = body.position.y;

    var force = 1/10000;

    return {
        x: x < 0 ? -x*force : x > render.canvas.width ? -(x - render.canvas.width)*force : 0,
        y: y < 0 ? -y*force : y > render.canvas.height - minHeightBuffer ? -(y - render.canvas.height + minHeightBuffer)*force : 0
    }
}

var targetVelocities = []

function moveTowards(current, target, maxDelta)
{
    if (Math.abs(target - current) <= maxDelta)
    {
        return target;
    }
    return current + Math.sign(target - current) * maxDelta;
}

for (var i = 0; i < iconBodies.length; i++) {
    var body = iconBodies[i];
    newAngle = 2 * Math.PI * Math.random();
    targetVelocities.push({
        angle: newAngle, 
        x:Math.cos(newAngle) * 1, 
        y:Math.sin(newAngle) * 1, 
        escaped: false
    });
}

Events.on(engine, 'beforeUpdate', function(event) {
    var engine = event.source;

    var bodies = Composite.allBodies(engine.world);

    for (var i = 0; i < bodies.length; i++) {
        var body = bodies[i];

        if (!body.isStatic) {
            if (hasBodyEscaped(body)) {
                Body.applyForce(body, body.position, getReturnForce(body));
                if (!targetVelocities[i].escaped) {
                    targetVelocities[i].angle = (targetVelocities[i].angle + Math.PI) % (Math.PI * 2);
                    targetVelocities[i].escaped = true;
                }
            } else if (targetVelocities.length > 0 && mouseConstraint.body !== body) {
                Body.setVelocity(body, {
                    x: moveTowards(body.velocity.x, targetVelocities[i].x, 0.01),
                    y: moveTowards(body.velocity.y, targetVelocities[i].y, 0.01)
                })
                targetVelocities[i].escaped = false;
            }
        }
    }

    if (event.timestamp % 50 < 50) {
        for (var i = 0; i < targetVelocities.length; i++) {
            newAngle = (targetVelocities[i].angle + (Math.random()-0.5) * 0.1) % (Math.PI * 2);
            targetVelocities[i] = {
                angle: newAngle,
                x: Math.cos(newAngle) * 1,
                y: Math.sin(newAngle) * 1,
                angular: Math.random() - 0.5
            };
        }
    }
});

engine.gravity.scale = 0;

window.addEventListener("resize", function(){
    render.canvas.width = background.getBoundingClientRect().width;
    render.canvas.height = background.getBoundingClientRect().height;
});

// run the renderer
Render.run(render);

// create runner
var runner = Runner.create();

// run the engine
Runner.run(runner, engine);
});