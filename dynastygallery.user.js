// ==UserScript==
// @name        Dynasty Gallery View
// @namespace   dynasty-scans.com
// @include     https://dynasty-scans.com/*
// @version     2.1.3
// @grant       none
// @author      cyricc
// @downloadURL https://github.com/luejerry/dynasty-gallery/raw/master/dynastygallery.user.js
// @updateURL   https://github.com/luejerry/dynasty-gallery/raw/master/dynastygallery.user.js
// ==/UserScript==

(function () {

  'use strict';
  /* Definitions */

  // Our global mutable state
  let currentImage = 0;
  let currentImagePage;
  let firstRun = true;
  let viewerOpen = false;

  // Promisify XMLHttpRequest
  const httpGet = function (url) {
    return new Promise((resolve, reject) => {
      const xhttp = new XMLHttpRequest();
      xhttp.onload = () => {
        if (xhttp.status === 200) {
          resolve(xhttp.responseXML);
        } else {
          reject(Error(xhttp.statusText));
        }
      };
      xhttp.open('GET', url);
      xhttp.responseType = 'document';
      xhttp.send();
    });
  };

  // Utility to check if element is an input field
  const isTextField = function (element) {
    return ['TEXTAREA', 'INPUT'].includes(element.tagName);
  }

  // Moves to and displays next image
  const nextImage = function () {
    if (imageLinks[currentImage + 1] !== undefined) {
      currentImage++;
    }
    updateImage();
    prefetchImages();
  };

  // Moves to and displays previous image
  const prevImage = function () {
    if (imageLinks[currentImage - 1] !== undefined) {
      currentImage--;
    }
    updateImage();
    prefetchImages();
  };

  // Moves to and displays image at the given index
  const jumpToImage = function (index) {
    currentImage = index;
    updateImage();
    prefetchImages();
  };

  // Fetch and display current image
  const updateImage = async function () {
    imageLoading();
    currentImagePage = await asyncLoadImage(image, currentImage);
    if (image.complete) { // workaround for Safari
      imageLoaded();
    }
  };

  // Prefetch the prev/next images to cache
  const prefetchImages = function () {
    if (imageLinks[currentImage + 1] !== undefined) {
      asyncPrefetchImage(currentImage + 1);
    }
    if (imageLinks[currentImage - 1] !== undefined) {
      asyncPrefetchImage(currentImage - 1);
    }
  };

  // Prefetch image at index to the cache
  const asyncPrefetchImage = async function (index) {
    const imagePage = await httpGet(imagePages[index]);
    const fullImage = imagePage.getElementsByClassName('image')[0].firstChild;
    await httpGet(fullImage.src);
  }

  // Fetch the target image page and load its image into given img
  const asyncLoadImage = async function (img, index) {
    let imagePage;
    updateLoadingProgress(0);
    if (!imageLinks[index]) {
      // Need to follow link to page to get the image URL
      imagePage = await httpGet(imagePages[index]);
      const fullImage = imagePage.getElementsByClassName('image')[0].firstChild;
      imageLinks[index] = fullImage.src;
    }
    // We need image page to be returned, so if we skipped it earlier issue a concurrent request
    // for it while we load the image
    const imagePagePromise = !imagePage && httpGet(imagePages[index]);

    // Try using fetch so that image loading progress can be shown
    const response = await fetch(imageLinks[index]);
    const size = response.headers.get('Content-Length');
    if (response.body.getReader && size) {
      const reader = response.body.getReader();
      let progress = 0;
      while(true) {
        const {done, value} = await reader.read();
        if (done) {
          break;
        }
        progress += value.length;
        updateLoadingProgress(progress / size);
      }
    }

    img.src = imageLinks[index];
    return imagePage || await imagePagePromise;
  };

  // Populates tags for the current image
  const updateTags = function (imagePage) {
    const tags = Array.from(imagePage.getElementsByClassName('tags')[0].children)
      .filter(e => e.tagName === 'A');
    if (!tags.length) {
      return;
    }
    tagOverlay.style.display = 'none';
    while (tagOverlay.firstChild) {
      tagOverlay.removeChild(tagOverlay.firstChild);
    }
    tags.forEach(tag => {
      tag.style.marginRight = '3px';
      tagOverlay.appendChild(tag);
    });
    tagOverlay.style.display = 'inherit';
  };

  // Load and display comments into the comments window
  const updateComments = function (imagePage) {
    const comments = Array.from(imagePage.getElementsByClassName('image_comments')[0].children);
    if (!comments.length) {
      return;
    }
    commentsLinkBadge.textContent = `${comments.length - 1}`;
    commentsList.style.display = 'none';
    while (commentsList.firstChild) {
      commentsList.removeChild(commentsList.firstChild);
    }
    comments.filter(e => e.tagName === 'FORM')
      .map(form => form.getElementsByTagName('textarea')[0])
      .forEach(textarea => Object.assign(textarea.style, {
        height: '80px',
        marginTop: '20px',
        maxWidth: '624px',
      }));
    comments.forEach(div => {
      commentsList.appendChild(div);
    });
    commentsList.style.display = 'inherit';
  };

  const updateImageSource = function (imagePage) {
    const imageSource = Array.from(imagePage.getElementsByClassName('btn'))
      .find(btn => btn.textContent === ' Source');
    if (imageSource) {
      sourceLink.style.display = 'inherit';
      sourceLink.href = imageSource.href;
    } else {
      sourceLink.style.display = 'none';
    }
  };

  const updateImageRaw = function (src) {
    rawLink.href = src;
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
      display: 'none',
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

  // Attach expand buttons to all thumbnails
  const addViewerIcons = function () {
    const mouseoutEvent = new MouseEvent('mouseout', {});
    const mouseleaveEvent = new MouseEvent('mouseleave', {});
    thumbnailLinks.forEach((a, index) => {
      const viewerIcon = createViewerIcon(index);
      a.onmouseenter = showIconPartial(viewerIcon);
      a.onmouseleave = hideIconPartial(viewerIcon);
      viewerIcon.addEventListener('click', () => {
        a.dispatchEvent(mouseoutEvent);
        a.dispatchEvent(mouseleaveEvent);
      });
      a.appendChild(viewerIcon);
    });
  };

  // Wraps page content in a div to prevent background scrolling behind modal
  const wrapContentDiv = function () {
    const scrollPosition = window.scrollY;
    contentContainer.appendChild(contentDiv);
    contentContainer.style.willChange = 'transform';
    contentContainer.style.display = 'initial';
    contentContainer.scrollTop = scrollPosition;
  };

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
    imageContainer.appendChild(bottomOverlay)
      .appendChild(bottomTooltips);
    bottomOverlay.appendChild(bottomButtonGroup);
    bottomButtonGroup.appendChild(rawLink);
    bottomButtonGroup.appendChild(sourceLink);
    bottomButtonGroup.appendChild(commentsLink);
    bodyFragment.appendChild(commentsBackgroundOverlay)
      .appendChild(commentsContainer)
      .appendChild(commentsList);
    divLoading.appendChild(divLoadingProgress);
    bodyFragment.appendChild(divLoading);
    bodyFragment.appendChild(arrowNext);
    bodyFragment.appendChild(arrowPrev);
    return bodyFragment;
  };

  // Initialize viewer elements and load into the DOM
  const initializeViewer = function () {
    document.body.insertBefore(contentContainer, contentDiv.nextSibling);
    hideOverlay();
    document.body.appendChild(createViewerElements());
    window.jQuery('[data-toggle="tooltip"]').tooltip();
  };


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
    divLoading.style.display = 'none';
    viewerOpen = false;
  };
  const showOverlay = () => {
    if (firstRun) {
      firstRun = false;
      initializeViewer();
      wrapContentDiv();
    }
    imageOverlay.style.display = 'initial';
    backgroundOverlay.style.display = 'initial';
    viewerOpen = true;
  };
  const imageLoaded = () => {
    divLoading.style.display = 'none';
    divLoading.style.opacity = '0';
    image.style.filter = null;
    imageOverlay.scrollTop = 0;
    updateComments(currentImagePage);
    updateTags(currentImagePage);
    updateImageSource(currentImagePage);
    updateImageRaw(image.src);
    enableTagOverlay();
    enableBottomOverlay();
  };
  const imageLoading = () => {
    divLoading.style.display = 'initial';
    void(divLoading.offsetHeight);
    divLoading.style.opacity = '1';
    image.style.filter = 'brightness(75%)';
  };
  const updateLoadingProgress = (fraction) => {
    divLoadingProgress.style.width = `${Math.round(fraction * 100)}%`;
    divLoadingProgress.style.opacity = (0 < fraction && fraction < 1) ? '1' : '0';
  }
  const showTagOverlay = () => {
    tagOverlay.style.opacity = '1';
    bottomOverlay.style.opacity = '1';
  };
  const hideTagOverlay = () => {
    tagOverlay.style.opacity = '0';
    bottomOverlay.style.opacity = '0';
  };
  const enableTagOverlay = () => tagOverlay.style.display = 'initial';
  const enableBottomOverlay = () => bottomOverlay.style.display = 'initial';
  const showComments = () => {
    image.style.filter = 'brightness(70%)';
    commentsBackgroundOverlay.style.display = 'initial';
    commentsBackgroundOverlay.scrollTop = 0;
    // updateComments();
  };
  const hideComments = () => {
    commentsBackgroundOverlay.style.display = 'none';
    image.style.filter = null;
  };
  const showIconPartial = (viewerIcon) => () => {
    viewerIcon.style.display = 'initial';
    viewerIcon.style.opacity = '1';
  };
  const hideIconPartial = (viewerIcon) => () => viewerIcon.style.opacity = '0';
  const showNavPartial = (nav) => () => {
    nav.style.display = 'initial';
    showTagOverlay();
  };
  const hideNavPartial = (nav) => () => {
    nav.style.display = 'none';
    hideTagOverlay();
  };


  /* Keybindings */
  // Esc key closes viewer
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      hideOverlay();
      hideComments();
    }
  });

  // Arrow key navigation
  document.addEventListener('keydown', event => {
    if (viewerOpen && event.key === 'ArrowLeft' && !isTextField(event.target)) {
      hideComments();
      prevImage();
    }
  });
  document.addEventListener('keydown', event => {
    if (viewerOpen && event.key === 'ArrowRight' && !isTextField(event.target)) {
      hideComments();
      nextImage();
    }
  });


  /* Create DOM elements */

  // Page content scroll wrapper, to prevent background scrolling behind modal
  const contentContainer = document.createElement('div');
  contentContainer.id = 'gallery-contentContainer';
  Object.assign(contentContainer.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    overflow: 'auto',
    display: 'none',
  });

  // Overlay to darken background page
  const backgroundOverlay = document.createElement('div');
  backgroundOverlay.id = 'gallery-backgroundOverlay';
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
  imageOverlay.id = 'gallery-imageOverlay';
  Object.assign(imageOverlay.style, {
    position: 'fixed',
    top: '0',
    right: '0',
    bottom: '0',
    left: '0',
    marginLeft: '-25%',
    marginRight: '-25%',
    overflowY: 'scroll',
    willChange: 'transform',
  });
  imageOverlay.onclick = hideOverlay;

  // Lightbox
  const imageContainer = document.createElement('div');
  imageContainer.id = 'gallery-imageContainer';
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
  image.id = 'gallery-image';
  Object.assign(image.style, {
    margin: 'auto',
    display: 'block',
    borderRadius: '5px',
    marginTop: '25px',
    marginBottom: '25px',
  });
  image.onload = imageLoaded;

  // Tag overlay
  const tagOverlay = document.createElement('div');
  tagOverlay.id = 'gallery-tags';
  Object.assign(tagOverlay.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    right: '0',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: '5px 5px 0 0',
    marginTop: '25px',
    padding: '5px 7px 6px 7px',
    transition: 'opacity 0.2s',
    display: 'none',
  });
  tagOverlay.onmouseenter = showTagOverlay;
  tagOverlay.onmouseleave = hideTagOverlay;

  // Bottom image overlay (currently contains only comment button)
  const bottomOverlay = document.createElement('div');
  bottomOverlay.id = 'gallery-footer';
  Object.assign(bottomOverlay.style, {
    position: 'absolute',
    bottom: '0',
    left: '0',
    right: '0',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: '0 0 5px 5px',
    marginBottom: '25px',
    padding: '5px 9px 6px 9px',
    transition: 'opacity 0.2s',
    textAlign: 'right',
    display: 'none',
  });
  bottomOverlay.onmouseenter = showTagOverlay;
  bottomOverlay.onmouseleave = hideTagOverlay;
  bottomOverlay.onclick = event => event.stopPropagation();

  // Bottom bar button group
  const bottomButtonGroup = document.createElement('div');
  bottomButtonGroup.id = 'gallery-buttons';
  bottomButtonGroup.classList.add('btn-group');

  // Hidden container for button tooltips
  const bottomTooltips = document.createElement('div');
  bottomTooltips.id = 'gallery-tooltips';
  Object.assign(bottomTooltips.style, {
    position: 'absolute',
    left: '-50px',
    right: '-50px',
  });

  // Button to show comments
  const commentsLink = document.createElement('a');
  commentsLink.id = 'gallery-commentsLink';
  commentsLink.classList.add('btn', 'btn-small');
  commentsLink.setAttribute('data-toggle', 'tooltip');
  commentsLink.setAttribute('data-placement', 'top');
  commentsLink.setAttribute('data-container', '#gallery-tooltips');
  commentsLink.setAttribute('title', 'View comments');
  const commentsLinkIcon = document.createElement('i');
  commentsLinkIcon.classList.add('icon-comment');
  const commentsLinkBadge = document.createTextNode('0');
  commentsLink.appendChild(commentsLinkIcon);
  commentsLink.appendChild(document.createTextNode(' '));
  commentsLink.appendChild(commentsLinkBadge);
  commentsLink.onclick = showComments;

  // Link to source
  const sourceLink = document.createElement('a');
  sourceLink.id = 'gallery-sourceLink';
  sourceLink.classList.add('btn', 'btn-small');
  sourceLink.setAttribute('data-toggle', 'tooltip');
  sourceLink.setAttribute('data-placement', 'top');
  sourceLink.setAttribute('data-container', '#gallery-tooltips');
  sourceLink.setAttribute('title', 'Go to source');
  const sourceLinkIcon = document.createElement('i');
  sourceLinkIcon.classList.add('icon-globe');
  sourceLink.appendChild(sourceLinkIcon);
  // sourceLink.appendChild(document.createTextNode(' Source'));

  // Link to raw image
  const rawLink = document.createElement('a');
  rawLink.id = 'gallery-rawLink';
  rawLink.classList.add('btn', 'btn-small');
  rawLink.setAttribute('data-toggle', 'tooltip');
  rawLink.setAttribute('data-placement', 'top');
  rawLink.setAttribute('data-container', '#gallery-tooltips');
  rawLink.setAttribute('title', 'Open image');
  const rawLinkIcon = document.createElement('i');
  rawLinkIcon.classList.add('icon-picture');
  rawLink.appendChild(rawLinkIcon);
  // rawLink.appendChild(document.createTextNode(' Open Image'));

  // Overlay to close comments when clicking outside comments window
  const commentsBackgroundOverlay = document.createElement('div');
  commentsBackgroundOverlay.id = 'gallery-commentsBgOverlay';
  Object.assign(commentsBackgroundOverlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    bottom: '0',
    right: '0',
    marginLeft: '-20px',
    marginRight: '-20px',
    overflowY: 'scroll',
    willChange: 'transform',
    display: 'none',
  });
  commentsBackgroundOverlay.onclick = hideComments;

  // Base layer of scrollable comments window
  const commentsContainer = document.createElement('div');
  commentsContainer.id = 'gallery-commentsContainer';
  Object.assign(commentsContainer.style, {
    position: 'absolute',
    maxWidth: '700px',
    minWidth: '400px',
    left: '50%',
    transform: 'translateX(-50%)',
  });

  // Comments window
  const commentsList = document.createElement('div');
  commentsList.id = 'gallery-comments';
  commentsList.classList.add('image_comments');
  Object.assign(commentsList.style, {
    margin: 'auto',
    marginTop: '40px',
    marginBottom: '40px',
    backgroundColor: 'white',
    borderRadius: '6px',
    boxShadow: '0 10px 60px rgba(0, 0, 0, 0.5)',
    border: '1px solid rgba(0, 0, 0, 0.2)',
    padding: '25px 35px',
  });
  commentsList.onclick = event => event.stopPropagation();

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
    display: 'none',
  };
  const arrowPrev = document.createElement('div');
  arrowPrev.id = 'gallery-prevIcon';
  arrowPrev.textContent = '❮';
  Object.assign(arrowPrev.style, arrowStyle);
  Object.assign(arrowPrev.style, {
    left: '0',
  });
  const arrowNext = document.createElement('div');
  arrowNext.id = 'gallery-nextIcon';
  arrowNext.textContent = '❯';
  Object.assign(arrowNext.style, arrowStyle);
  Object.assign(arrowNext.style, {
    right: '0',
  });

  // Navigation overlay buttons
  const navStyle = {
    position: 'absolute',
    top: '0',
    bottom: '0',
    cursor: 'pointer',
  };
  const navNext = document.createElement('div');
  Object.assign(navNext.style, navStyle);
  Object.assign(navNext.style, {
    left: '50%',
    right: '0',
    textAlign: 'right',
  });
  navNext.onclick = nextClicked;
  navNext.onmouseenter = showNavPartial(arrowNext);
  navNext.onmouseleave = hideNavPartial(arrowNext);
  const navPrev = document.createElement('div');
  Object.assign(navPrev.style, navStyle);
  Object.assign(navPrev.style, {
    left: '0',
    right: '50%',
    textAlign: 'left',
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
    borderRadius: '2px',
    transition: 'opacity 0.1s',
    transitionDelay: '0.3s',
    opacity: '0',
  });
  divLoading.textContent = 'Loading...';
  // Loading progress bar
  const divLoadingProgress = document.createElement('div');
  Object.assign(divLoadingProgress.style, {
    height: '2px',
    background: 'white',
    width: '0%',
    transition: 'width 0.15s ease-out, opacity 0.2s linear 0.3s',
  });


  /* Main */

  // console.log('Running Dynasty-Gallery userscript.');
  const thumbnailLinks = Array.from(document.getElementsByClassName('thumbnail'))
    .filter(e => e.tagName === 'A')
    .filter(a => a.href.indexOf('/images/') === 25)
    .filter(a => a.getElementsByTagName('img').length > 0);
  // console.log(`Dynasty-Gallery: found ${thumbnailLinks.length} gallery links.`);
  if (thumbnailLinks.length === 0) {
    return;
  }

  const imageLinks = thumbnailLinks.map(() => null); // this is populated as images are viewed
  const imagePages = thumbnailLinks.map(a => a.href);

  // Adjust site element margins, this is for preventing background scrolling
  const contentDiv = document.getElementById('content');
  contentDiv.style.marginBottom = '20px';
  document.body.style.marginBottom = '0px';

  // Put viewer icons into the DOM
  addViewerIcons();
})();
