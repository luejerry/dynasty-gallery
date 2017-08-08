// ==UserScript==
// @name        Dynasty Gallery View
// @namespace   dynasty-scans.com
// @include     https://dynasty-scans.com/*
// @version     1.0
// @grant       none
// @author      cyricc
// ==/UserScript==

(function () {

  'use strict';

  /* Function definitions */
  const httpGet = function (url) {
    return new Promise((resolve, reject) => {
      const xhttp = new XMLHttpRequest();
      xhttp.onload = () => {
        if (xhttp.status == 200) {
          resolve(xhttp.responseXML);
        } else {
          reject(Error(xhttp.statusText));
        }
      };
      xhttp.open('GET', url);
      xhttp.send();
    });
  };

  const nextImage = function () {
    if (imageLinks[currentImage + 1] !== undefined) {
      currentImage++;
    }
    return imageLinks[currentImage];
  };

  const prevImage = function () {
    if (imageLinks[currentImage - 1] !== undefined) {
      currentImage--;
    }
    return imageLinks[currentImage];
  };

  const changeImage = function (src) {
    image.style.filter = 'brightness(75%)';
    httpGet(src).then(() => {
      image.src = src;
    }).catch(() => {
      image.src = src.replace('.jpg', '.png');
    });
  };

  const jumpToImage = function (a) {
    const imageSrc = a.getElementsByTagName('img')[0].src;
    const origSrc = imageSrc.replace('/medium/', '/original/').replace('/thumb/', '/original/');
    currentImage = imageLinks.findIndex(src => src === origSrc);
    changeImage(origSrc);
  };

  const createViewerIcon = function (a) {
    const viewerIcon = document.createElement('div');
    Object.assign(viewerIcon.style, {
      position: 'absolute',
      marginTop: '-24px',
      backgroundColor: '#ffffff',
      display: 'none',
      padding: '3px',
      width: '20px',
      height: '20px',
      borderRadius: '2px',
      textAlign: 'center'
    });
    const icon = document.createElement('i');
    icon.classList.add('icon-resize-full');
    viewerIcon.appendChild(icon);
    viewerIcon.onclick = event => {
      showOverlay();
      jumpToImage(a);
      event.stopPropagation();
      event.preventDefault();
    };
    return viewerIcon;
  };


  /* Event handlers */
  const prevClicked = event => {
    changeImage(prevImage());
    event.stopPropagation();
  };
  const nextClicked = event => {
    changeImage(nextImage());
    event.stopPropagation();
  };
  const hideOverlay = () => {
    imageOverlay.style.display = 'none';
    backgroundOverlay.style.display = 'none';
  };
  const showOverlay = () => {
    imageOverlay.style.display = 'initial';
    backgroundOverlay.style.display = 'initial';
  };


  /* Bind ESC key to close overlay */
  document.onkeydown = event => {
    event = event || window.event;
    if (event.keyCode == 27) {
      hideOverlay();
    }
  };


  /* Creating DOM elements */
  const backgroundOverlay = document.createElement('div');
  Object.assign(backgroundOverlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  });
  backgroundOverlay.onclick = hideOverlay;

  const imageOverlay = document.createElement('div');
  Object.assign(imageOverlay.style, {
    position: 'absolute',
    top: '0',
    right: '0',
    bottom: '0',
    left: '0',
  });
  imageOverlay.onclick = hideOverlay;

  const imageContainer = document.createElement('div');
  Object.assign(imageContainer.style, {
    position: 'absolute',
    minHeight: '250px',
    minWidth: '250px',
    left: '50%',
    transform: 'translateX(-50%)',
    marginTop: '25px'
  });

  const image = document.createElement('img');
  Object.assign(image.style, {
    margin: 'auto',
    display: 'block',
    borderRadius: '5px'
  });
  image.onload = () => image.style.filter = null;

  const nextPrevStyle = {
    position: 'absolute',
    top: '0',
    bottom: '0',
    opacity: '0',
    // transition: 'opacity 0.2s',
    cursor: 'pointer'
  };
  const next = document.createElement('div');
  Object.assign(next.style, nextPrevStyle);
  Object.assign(next.style, {
    left: '50%',
    right: '0',
    textAlign: 'right'
  });
  next.onclick = nextClicked;
  next.onmouseenter = () => next.style.opacity = '1';
  next.onmouseleave = () => next.style.opacity = '0';
  const prev = document.createElement('div');
  Object.assign(prev.style, nextPrevStyle);
  Object.assign(prev.style, {
    left: '0',
    right: '50%',
    textAlign: 'left'
  });
  prev.onclick = prevClicked;
  prev.onmouseenter = () => prev.style.opacity = '1';
  prev.onmouseleave = () => prev.style.opacity = '0';

  const arrowStyle = {
    position: 'absolute',
    top: '50%',
    marginTop: '-25px',
    color: '#888888',
    fontSize: '50px',
    WebkitTextStroke: '1.5px white'
  };
  const prevArrow = document.createElement('div');
  prevArrow.textContent = '❮';
  Object.assign(prevArrow.style, arrowStyle);
  Object.assign(prevArrow.style, {
    left: '0'
  });
  const nextArrow = document.createElement('div');
  nextArrow.textContent = '❯';
  Object.assign(nextArrow.style, arrowStyle);
  Object.assign(nextArrow.style, {
    right: '0'
  });


  /* Main */
  console.log('Running Dynasty-Gallery userscript.');
  const thumbnailLinks = Array.from(document.getElementsByClassName('thumbnail'))
    .filter(e => e.tagName === 'A')
    .filter(a => a.href.indexOf('/images/') == 25);
  console.log(`Dynasty-Gallery: found ${thumbnailLinks.length} gallery links.`);
  thumbnailLinks.forEach(a => {
    const viewerIcon = createViewerIcon(a);
    a.appendChild(viewerIcon);
    a.onmouseenter = () => viewerIcon.style.display = 'initial';
    a.onmouseleave = () => viewerIcon.style.display = 'none';
  });
  const imageLinks = thumbnailLinks
    .map(a => a.getElementsByTagName('img')[0])
    .filter(img => img !== undefined)
    .map(img => img.src.replace('/medium/', '/original/').replace('/thumb/', '/original/'));

  let currentImage = 0;
  hideOverlay();
  document.body.appendChild(backgroundOverlay);
  document.body.appendChild(imageOverlay)
    .appendChild(imageContainer)
    .appendChild(image);
  imageContainer.appendChild(next).appendChild(nextArrow);
  imageContainer.appendChild(prev).appendChild(prevArrow);
})();
