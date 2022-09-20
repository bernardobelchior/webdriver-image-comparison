import { takeBase64Screenshot } from '../methods/screenshots';
import { makeCroppedBase64Image } from '../methods/images';
import beforeScreenshot from '../helpers/beforeScreenshot';
import afterScreenshot from '../helpers/afterScreenshot';
import { determineElementRectangles } from '../methods/rectangles';
import { AfterScreenshotOptions, ScreenshotOutput } from '../helpers/afterScreenshot.interfaces';
import { Methods } from '../methods/methods.interface';
import { InstanceData } from '../methods/instanceData.interfaces';
import { Folders } from '../base.interface';
import { SaveElementOptions } from './element.interfaces';
import { ElementRectanglesOptions, RectanglesOutput } from '../methods/rectangles.interfaces';
import { BeforeScreenshotOptions, BeforeScreenshotResult } from '../helpers/beforeScreenshot.interface';
import { DEFAULT_RESIZE_DIMENSIONS } from '../helpers/constants';
import { ResizeDimensions } from '../methods/images.interfaces';
import scrollElementIntoView from '../clientSideScripts/scrollElementIntoView';
import { waitFor } from '../helpers/utils';
import scrollToPosition from '../clientSideScripts/scrollToPosition';

/**
 * Saves an image of an element
 */
export default async function saveElement(
  methods: Methods,
  instanceData: InstanceData,
  folders: Folders,
  element: HTMLElement,
  tag: string,
  saveElementOptions: SaveElementOptions,
): Promise<ScreenshotOutput> {
  // 1a. Set some variables
  const { addressBarShadowPadding, formatImageName, logLevel, savePerInstance, toolBarShadowPadding } = saveElementOptions.wic;
  const { executor } = methods;
  // 1b. Set the method options to the right values
  const disableCSSAnimation: boolean =
    'disableCSSAnimation' in saveElementOptions.method
      ? saveElementOptions.method.disableCSSAnimation
      : saveElementOptions.wic.disableCSSAnimation;
  const hideScrollBars: boolean =
    'hideScrollBars' in saveElementOptions.method
      ? saveElementOptions.method.hideScrollBars
      : saveElementOptions.wic.hideScrollBars;
  const resizeDimensions: ResizeDimensions | number = saveElementOptions.method.resizeDimensions || DEFAULT_RESIZE_DIMENSIONS;
  const hideElements: HTMLElement[] = saveElementOptions.method.hideElements || [];
  const removeElements: HTMLElement[] = saveElementOptions.method.removeElements || [];

  // 2.  Prepare the beforeScreenshot
  const beforeOptions: BeforeScreenshotOptions = {
    instanceData,
    addressBarShadowPadding,
    disableCSSAnimation,
    hideElements,
    logLevel,
    noScrollBars: hideScrollBars,
    removeElements,
    toolBarShadowPadding,
  };
  const enrichedInstanceData: BeforeScreenshotResult = await beforeScreenshot(executor, beforeOptions, true);
  const devicePixelRatio = enrichedInstanceData.dimensions.window.devicePixelRatio;
  const isLandscape = enrichedInstanceData.dimensions.window.isLandscape;

  // Scroll the element into top of the viewport and return the current scroll position
  const currentPosition = await executor(scrollElementIntoView, element, addressBarShadowPadding);
  await waitFor(500);

  // 3.  Take the screenshot
  const base64Image: string = await takeBase64Screenshot(methods.screenShot);

  // 4.  Determine the rectangles
  const elementRectangleOptions: ElementRectanglesOptions = {
    devicePixelRatio,
    innerHeight: enrichedInstanceData.dimensions.window.innerHeight,
    isAndroidNativeWebScreenshot: enrichedInstanceData.isAndroidNativeWebScreenshot,
    isAndroid: enrichedInstanceData.isAndroid,
    isIos: enrichedInstanceData.isIos,
    isLandscape,
  };
  const rectangles: RectanglesOutput = await determineElementRectangles({
    executor,
    base64Image,
    options: elementRectangleOptions,
    element,
  });

  // When the screenshot has been taken and the element position has been determined,
  // we can scroll back to the original position
  // We don't need to wait for the scroll here because we don't take a screenshot after this
  await executor(scrollToPosition, currentPosition);

  // 5.  Make a cropped base64 image with resizeDimensions
  // @TODO: we have isLandscape here
  const croppedBase64Image = await makeCroppedBase64Image({
    base64Image,
    bezelCornerRadius: 0,
    devicePixelRatio,
    isLandscape,
    logLevel,
    notchData: { x: 0, y: 0, width: 0, height: 0 },
    rectangles,
    resizeDimensions,
  });

  // 6.  The after the screenshot methods
  const afterOptions: AfterScreenshotOptions = {
    actualFolder: folders.actualFolder,
    base64Image: croppedBase64Image,
    disableCSSAnimation,
    filePath: {
      browserName: enrichedInstanceData.browserName,
      deviceName: enrichedInstanceData.deviceName,
      isMobile: enrichedInstanceData.isMobile,
      savePerInstance: savePerInstance,
    },
    fileName: {
      browserName: enrichedInstanceData.browserName,
      browserVersion: enrichedInstanceData.browserVersion,
      deviceName: enrichedInstanceData.deviceName,
      devicePixelRatio: enrichedInstanceData.dimensions.window.devicePixelRatio,
      formatImageName,
      isMobile: enrichedInstanceData.isMobile,
      isTestInBrowser: enrichedInstanceData.isTestInBrowser,
      logName: enrichedInstanceData.logName,
      name: enrichedInstanceData.name,
      outerHeight: enrichedInstanceData.dimensions.window.outerHeight,
      outerWidth: enrichedInstanceData.dimensions.window.outerWidth,
      platformName: enrichedInstanceData.platformName,
      platformVersion: enrichedInstanceData.platformVersion,
      screenHeight: enrichedInstanceData.dimensions.window.screenHeight,
      screenWidth: enrichedInstanceData.dimensions.window.screenWidth,
      tag,
    },
    hideElements,
    hideScrollBars,
    isLandscape,
    logLevel,
    platformName: instanceData.platformName,
    removeElements,
  };

  // 7.  Return the data
  return afterScreenshot(executor, afterOptions);
}
