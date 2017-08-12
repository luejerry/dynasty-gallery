// ==UserScript==
// @name        Dynasty Gallery View
// @namespace   dynasty-scans.com
// @include     https://dynasty-scans.com/*
// @version     1.4.3
// @grant       none
// @author      cyricc
// ==/UserScript==

(function () {

  'use strict';

  /* Definitions */

  // Our global mutable state
  let currentImage = 0;

  // Promisify XMLHttpRequest
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

  // Moves to and displays next image
  const nextImage = function () {
    if (imageLinks[currentImage + 1] !== undefined) {
      currentImage++;
    }
    updateImage();
  };

  // Moves to and displays previous image
  const prevImage = function () {
    if (imageLinks[currentImage - 1] !== undefined) {
      currentImage--;
    }
    updateImage();
  };
  
  // Moves to and displays image at the given index
  const jumpToImage = function (index) {
    currentImage = index;
    updateImage();
  };

  // Fetches and displays the current image
  const updateImage = function () {
    imageLoading();
    const src = imageLinks[currentImage];
    const pngSrc = src.replace('.jpg', '.png');
    const gifSrc = src.replace('.jpg', '.gif');
    // Hacky way to deal with other image types, but much faster than fetch + scraping its url
    httpGet(src)
      .then(() => image.src = src)
      .catch(() => httpGet(pngSrc).then(() => image.src = pngSrc))
      .catch(() => image.src = gifSrc);
  };
  
  // Populates tags for the current image
  const updateTags = function () {
    const tagsHtml = imageTags[currentImage];
    if (tagsHtml === undefined) {
      disableTagOverlay();
    } else {
      tagOverlay.innerHTML = imageTags[currentImage];
      enableTagOverlay();
    }
  };

  // Attaches expand button to thumbnail at index
  const createViewerIcon = function (index) {
    const iconFrame = document.createElement('div');
    Object.assign(iconFrame.style, {
      position: 'absolute',
      marginTop: '-24px',
      backgroundColor: '#ffffff',
      opacity: '0',
      padding: '3px',
      width: '20px',
      height: '20px',
      borderRadius: '0 2px 0 2px',
      textAlign: 'center',
      transition: 'opacity 0.2s',
      display: 'none'
    });
    const icon = document.createElement('i');
    icon.classList.add('icon-resize-full');
    iconFrame.appendChild(icon);
    iconFrame.onclick = event => {
      showOverlay();
      jumpToImage(index);
      event.stopPropagation();
      event.preventDefault();
    };
    return iconFrame;
  };

  // Wraps page content in a div to prevent background scrolling behind modal
  const wrapContentDiv = function () {
    const contentDiv = document.getElementById('content');
    const placeholder = contentDiv.nextSibling;
    contentDiv.remove();
    const contentContainer = document.createElement('div');
    Object.assign(contentContainer.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      overflow: 'auto'
    });
    contentContainer.appendChild(contentDiv);
    document.body.insertBefore(contentContainer, placeholder);
  }

  // Constructs and returns the DOM tree for all viewer elements
  const createViewerElements = function () {
    const bodyFragment = document.createDocumentFragment();
    bodyFragment.appendChild(backgroundOverlay);
    bodyFragment.appendChild(imageOverlay)
      .appendChild(imageContainer)
      .appendChild(image);
    imageContainer.appendChild(navNext);
    imageContainer.appendChild(navPrev);
    imageContainer.appendChild(tagOverlay);
    imageOverlay.appendChild(divLoading);
    imageOverlay.appendChild(arrowNext);
    imageOverlay.appendChild(arrowPrev);
    return bodyFragment;
  }


  /* Event handlers */
  const prevClicked = event => {
    prevImage();
    event.stopPropagation();
  };
  const nextClicked = event => {
    nextImage();
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
  const imageLoaded = () => {
    divLoading.style.display = 'none';
    image.style.filter = null;
    updateTags();
    imageOverlay.scrollTop = 0;
  };
  const imageLoading = () => {
    divLoading.style.display = 'initial';
    image.style.filter = 'brightness(75%)';
  };
  const showTagOverlay = () => tagOverlay.style.opacity = '1';
  const hideTagOverlay = () => tagOverlay.style.opacity = '0';
  const enableTagOverlay = () => tagOverlay.style.display = 'initial';
  const disableTagOverlay = () => tagOverlay.style.display = 'none';
  const showIconPartial = (viewerIcon) => () => {
    viewerIcon.style.display = 'initial';
    viewerIcon.style.opacity = '1';
  };
  const hideIconPartial = (viewerIcon) => () => viewerIcon.style.opacity = '0';
  const showNavPartial = (nav) => () => {
    nav.style.opacity = '1';
    showTagOverlay();
  };
  const hideNavPartial = (nav) => () => {
    nav.style.opacity = '0';
    hideTagOverlay();
  };


  /* Bind ESC key to close overlay */
  document.onkeydown = event => {
    event = event || window.event;
    if (event.keyCode == 27) {
      hideOverlay();
    }
  };


  /* Create DOM elements */

  // Overlay to darken background page
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

  // Frame to anchor the lightbox
  const imageOverlay = document.createElement('div');
  Object.assign(imageOverlay.style, {
    position: 'fixed',
    top: '0',
    right: '0',
    bottom: '0',
    left: '0',
    marginLeft: '-25%',
    marginRight: '-25%',
    overflowY: 'auto'
  });
  imageOverlay.onclick = hideOverlay;

  // Lightbox
  const imageContainer = document.createElement('div');
  Object.assign(imageContainer.style, {
    position: 'absolute',
    minHeight: '250px',
    minWidth: '250px',
    maxWidth: '120%',
    left: '50%',
    transform: 'translateX(-50%)',
  });

  // Full size image
  const image = document.createElement('img');
  Object.assign(image.style, {
    margin: 'auto',
    display: 'block',
    borderRadius: '5px',
    marginTop: '25px',
    marginBottom: '25px'
  });
  image.onload = imageLoaded;

  // Tag overlay
  const tagOverlay = document.createElement('div');
  Object.assign(tagOverlay.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    right: '0',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: '5px 5px 0 0',
    marginTop: '25px',
    paddingTop: '5px',
    paddingBottom: '6px',
    paddingLeft: '7px',
    paddingRight: '7px',
    transition: 'opacity 0.2s',
  });
  tagOverlay.onmouseenter = showTagOverlay;
  tagOverlay.onmouseleave = hideTagOverlay;

  // Navigation arrows
  const arrowStyle = {
    position: 'fixed',
    top: '50%',
    marginTop: '-16px',
    marginLeft: '8px',
    marginRight: '8px',
    color: '#000000',
    fontSize: '36px',
    fontWeight: 'bold',
    WebkitTextStroke: '1.5px white',
    opacity: '0'
  };
  const arrowPrev = document.createElement('div');
  arrowPrev.textContent = '❮';
  Object.assign(arrowPrev.style, arrowStyle);
  Object.assign(arrowPrev.style, {
    left: '0'
  });
  const arrowNext = document.createElement('div');
  arrowNext.textContent = '❯';
  Object.assign(arrowNext.style, arrowStyle);
  Object.assign(arrowNext.style, {
    right: '0'
  });

  // Navigation overlay buttons
  const navStyle = {
    position: 'absolute',
    top: '0',
    bottom: '0',
    cursor: 'pointer'
  };
  const navNext = document.createElement('div');
  Object.assign(navNext.style, navStyle);
  Object.assign(navNext.style, {
    left: '50%',
    right: '0',
    textAlign: 'right'
  });
  navNext.onclick = nextClicked;
  navNext.onmouseenter = showNavPartial(arrowNext);
  navNext.onmouseleave = hideNavPartial(arrowNext);
  const navPrev = document.createElement('div');
  Object.assign(navPrev.style, navStyle);
  Object.assign(navPrev.style, {
    left: '0',
    right: '50%',
    textAlign: 'left'
  });
  navPrev.onclick = prevClicked;
  navPrev.onmouseenter = showNavPartial(arrowPrev);
  navPrev.onmouseleave = hideNavPartial(arrowPrev);

  // Loading indicator
  const divLoading = document.createElement('div');
  Object.assign(divLoading.style, {
    position: 'fixed',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    color: 'white',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontWeight: 'bold',
    textAlign: 'center',
    width: '100px',
    padding: '5px',
    borderRadius: '2px'
  });
  divLoading.textContent = 'Loading...';


  /* Main */

  console.log('Running Dynasty-Gallery userscript.');
  const thumbnailLinks = Array.from(document.getElementsByClassName('thumbnail'))
    .filter(e => e.tagName === 'A')
    .filter(a => a.href.indexOf('/images/') == 25)
    .filter(a => a.getElementsByTagName('img').length > 0);
  console.log(`Dynasty-Gallery: found ${thumbnailLinks.length} gallery links.`);
  if (thumbnailLinks.length == 0) {
    return;
  }
  thumbnailLinks.forEach((a, index) => {
    const viewerIcon = createViewerIcon(index);
    a.onmouseenter = showIconPartial(viewerIcon);
    a.onmouseleave = hideIconPartial(viewerIcon);
    a.appendChild(viewerIcon);
  });
  // Hacky way to get the full size links, but much faster than scraping every image page
  const imageLinks = thumbnailLinks
    .map(a => a.getElementsByTagName('img')[0])
    .map(img => img.src.replace('/medium/', '/original/').replace('/thumb/', '/original/'));
  const imageTags = thumbnailLinks.map(a => a.dataset.content);

  // Put everything into the DOM
  hideOverlay();
  wrapContentDiv();
  document.body.appendChild(createViewerElements());
})();
