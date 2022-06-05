// From https://www.w3schools.com/howto/howto_js_fullscreen.asp
/* Get the documentElement (<html>) to display the page in fullscreen */
var elem = document.documentElement;
const gui = document.getElementById( 'gui' );

function toggleFullscreen() {
    if (document.fullscreenElement) {
        closeFullscreen();
    } else {
        openFullscreen();
    }
}

/* View in fullscreen */
function openFullscreen() {
  gui.style.display = 'none';
  document.querySelector( '.lil-gui' ).style.display = 'none';
  if (elem.requestFullscreen) {
    elem.requestFullscreen();
  } else if (elem.webkitRequestFullscreen) { /* Safari */
    elem.webkitRequestFullscreen();
  } else if (elem.msRequestFullscreen) { /* IE11 */
    elem.msRequestFullscreen();
  }
}

/* Close fullscreen */
function closeFullscreen() {
  gui.style.display = 'inline';
  document.querySelector( '.lil-gui' ).style.display = 'inline';
  if (document.exitFullscreen) {
    document.exitFullscreen();
  } else if (document.webkitExitFullscreen) { /* Safari */
    document.webkitExitFullscreen();
  } else if (document.msExitFullscreen) { /* IE11 */
    document.msExitFullscreen();
  }
}

if (document.addEventListener) {
  document.addEventListener('fullscreenchange', exitHandler, false);
  document.addEventListener('mozfullscreenchange', exitHandler, false);
  document.addEventListener('MSFullscreenChange', exitHandler, false);
  document.addEventListener('webkitfullscreenchange', exitHandler, false);
}

function exitHandler()
{
  if (!document.webkitIsFullScreen && !document.mozFullScreen && !document.msFullscreenElement)
  {
    gui.style.display = 'inline';
    document.querySelector( '.lil-gui' ).style.display = 'inline';
  }
}