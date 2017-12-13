// ==UserScript==
// @name        Dynasty Gallery View
// @namespace   dynasty-scans.com
// @include     https://dynasty-scans.com/*
// @version     1.81
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
  let firstRun = true;

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

  // Fetches and displays the current image
  const updateImage = function () {
    imageLoading();
    loadImageScrape(image, currentImage);
  };

  // Prefetch the prev/next images to cache
  const prefetchImages = function () {
    if (imageLinks[currentImage + 1] !== undefined) {
      loadImageScrape(imagePrefetchNext, currentImage + 1);
    }
    if (imageLinks[currentImage - 1] !== undefined) {
      loadImageScrape(imagePrefetchPrev, currentImage - 1);
    }
  };

  // Scrape the full size image url from the image page
  const getImageSrc = async function (imagePageHref) {
    const imagePage = await httpGet(imagePageHref);
    const image = imagePage.getElementsByClassName('image')[0].firstChild;
    return image.src;
  };

  // Load an image in the image src list
  const loadImageScrape = async function (img, index) {
    if (imageLinks[index]) {
      img.src = imageLinks[index];
      return Promise.resolve();
    }
    const src = await getImageSrc(imagePages[index]);
    imageLinks[index] = src;
    img.src = src;
    return Promise.resolve();
  };

  // Populates tags for the current image
  const updateTags = function () {
    const tagsHtml = imageTags[currentImage];
    if (tagsHtml === undefined) {
      disableTagOverlay();
    } else {
      disableTagOverlay();
      tagOverlay.innerHTML = imageTags[currentImage];
      const tagElements = Array.from(tagOverlay.getElementsByClassName('label'));
      tagElements.forEach(label => {
        const tagLink = document.createElement('a');
        tagLink.href = tagToHref(label.textContent);
        tagLink.appendChild(label);
        tagOverlay.appendChild(tagLink);
        const spacer = document.createElement('text');
        spacer.textContent = ' ';
        tagOverlay.appendChild(spacer);
      });
      enableTagOverlay();
    }
  };

  // Generates tag url from its text
  const tagToHref = function (tagText) {
    const matches = tagText.match(/^(?:(Author|Doujin|Series|Pairing|Scanlator): )?(.*)$/);
    const section = (matches[1] || 'tag').toLowerCase();
    const sectionName = section !== 'series' ? section + 's' : section;
    const tagWords = matches[2].match(/(\w+)/g);
    const tagName = tagWords === null ? 'blank' : tagWords.join('_').toLowerCase();
    return `/${sectionName}/${tagName}/images`;
  };

  // Get comment elements from the target image page
  const getComments = async function (imagePageHref) {
    const comments = (await httpGet(imagePageHref)).getElementsByClassName('image_comments')[0];
    return Array.from(comments.children);
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
      .appendChild(commentsLink);
    bodyFragment.appendChild(commentsBackgroundOverlay)
      .appendChild(commentsContainer);
    bodyFragment.appendChild(divLoading);
    bodyFragment.appendChild(arrowNext);
    bodyFragment.appendChild(arrowPrev);
    return bodyFragment;
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
  };
  const showOverlay = () => {
    if (firstRun) {
      firstRun = false;
      wrapContentDiv();
    }
    imageOverlay.style.display = 'initial';
    backgroundOverlay.style.display = 'initial';
  };
  const imageLoaded = () => {
    divLoading.style.display = 'none';
    divLoading.style.opacity = '0';
    image.style.filter = null;
    updateTags();
    imageOverlay.scrollTop = 0;
    enableBottomOverlay();
  };
  const imageLoading = () => {
    divLoading.style.display = 'initial';
    void(divLoading.offsetHeight);
    divLoading.style.opacity = '1';
    image.style.filter = 'brightness(75%)';
  };
  const showTagOverlay = () => {
    tagOverlay.style.opacity = '1';
    bottomOverlay.style.opacity = '1';
  };
  const hideTagOverlay = () => {
    tagOverlay.style.opacity = '0';
    bottomOverlay.style.opacity = '0';
  };
  const enableTagOverlay = () => tagOverlay.style.display = 'initial';
  const disableTagOverlay = () => tagOverlay.style.display = 'none';
  const enableBottomOverlay = () => bottomOverlay.style.display = 'initial';
  const showComments = async () => {
    image.style.filter = 'brightness(75%)';
    while (commentsContainer.firstChild) {
      commentsContainer.removeChild(commentsContainer.firstChild);
    }
    commentsContainer.appendChild(commentsLoading);
    commentsLoading.style.display = 'initial';
    commentsBackgroundOverlay.style.display = 'initial';
    const comments = await getComments(imagePages[currentImage]);
    commentsLoading.style.display = 'none';
    comments.forEach(div => {
      commentsContainer.appendChild(div);
    });
    const textArea = document.getElementById('forum_post_message');
    Object.assign(textArea.style, {
      height: '80px',
      marginTop: '20px'
    });
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


  /* Bind ESC key to close overlay */
  document.addEventListener('keydown', event => {
    event = event || window.event;
    if (event.key === 'Escape') {
      hideOverlay();
      hideComments();
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
    display: 'none'
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
    overflowY: 'auto',
    willChange: 'transform'
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
    marginBottom: '25px'
  });
  image.onload = imageLoaded;

  // Prefetched images
  const imagePrefetchNext = document.createElement('img');
  const imagePrefetchPrev = document.createElement('img');

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
    display: 'none'
  });
  tagOverlay.onmouseenter = showTagOverlay;
  tagOverlay.onmouseleave = hideTagOverlay;

  // Bottom image overlay (currently contains only comment button)
  const bottomOverlay = document.createElement('div');
  bottomOverlay.id = 'gallery-comments';
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
    display: 'none'
  });
  bottomOverlay.onmouseenter = showTagOverlay;
  bottomOverlay.onmouseleave = hideTagOverlay;
  bottomOverlay.onclick = event => event.stopPropagation();

  // Button to show comments
  const commentsLink = document.createElement('a');
  commentsLink.id = 'gallery-commentsLink';
  commentsLink.classList.add('btn', 'btn-small');
  const commentsLinkIcon = document.createElement('i');
  commentsLinkIcon.classList.add('icon-comment');
  commentsLink.appendChild(commentsLinkIcon);
  commentsLink.appendChild(document.createTextNode(' Comments'));
  commentsLink.onclick = showComments;

  // Overlay to close comments when clicking outside comments window
  const commentsBackgroundOverlay = document.createElement('div');
  commentsBackgroundOverlay.id = 'gallery-commentsBgOverlay';
  Object.assign(commentsBackgroundOverlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    bottom: '0',
    right: '0',
    marginLeft: '-25%',
    marginRight: '-25%',
    overflowY: 'auto',
    willChange: 'transform',
    // backgroundColor: 'rgba(0, 0, 0, 0.3)',
    display: 'none'
  });
  commentsBackgroundOverlay.onclick = hideComments;

  // Comments window
  const commentsContainer = document.createElement('div');
  commentsContainer.id = 'gallery-comments';
  commentsContainer.classList.add('image_comments');
  Object.assign(commentsContainer.style, {
    position: 'absolute',
    maxWidth: '800px',
    minWidth: '400px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'white',
    borderRadius: '6px',
    boxShadow: '0 10px 60px rgba(0, 0, 0, 0.5)',
    border: '1px solid rgba(0, 0, 0, 0.2)',
    padding: '25px 30px',
    marginTop: '40px',
    marginBottom: '40px'
  });
  commentsContainer.onclick = event => event.stopPropagation();

  // Comments loading text
  const commentsLoading = document.createElement('h3');
  commentsLoading.id = 'gallery-commentsLoading';
  Object.assign(commentsLoading.style, {
    textAlign: 'center',
    color: '#888888'
  });
  const commentsLoadingText = document.createElement('h3');
  commentsLoadingText.textContent = 'Loading comments...';
  commentsLoading.appendChild(commentsLoadingText);

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
    display: 'none'
  };
  const arrowPrev = document.createElement('div');
  arrowPrev.id = 'gallery-prevIcon';
  arrowPrev.textContent = '❮';
  Object.assign(arrowPrev.style, arrowStyle);
  Object.assign(arrowPrev.style, {
    left: '0'
  });
  const arrowNext = document.createElement('div');
  arrowNext.id = 'gallery-nextIcon';
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
    borderRadius: '2px',
    transition: 'opacity 0.1s',
    transitionDelay: '0.3s',
    opacity: '0'
  });
  divLoading.textContent = 'Loading...';


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
  // Hacky way to get the full size links, but much faster than scraping every image page
  // const imageLinks = thumbnailLinks
  //   .map(a => a.getElementsByTagName('img')[0])
  //   .map(img => img.src.replace('/medium/', '/original/').replace('/thumb/', '/original/'));
  const imageLinks = thumbnailLinks.map(() => null);
  const imageTags = thumbnailLinks.map(a => a.dataset.content);
  const imagePages = thumbnailLinks.map(a => a.href);

  // Adjust site element margins, this is for preventing background scrolling
  const contentDiv = document.getElementById('content');
  contentDiv.style.marginBottom = '20px';
  document.body.style.marginBottom = '0px';

  // Put everything into the DOM
  addViewerIcons();
  document.body.insertBefore(contentContainer, contentDiv.nextSibling);
  hideOverlay();
  document.body.appendChild(createViewerElements());
})();
