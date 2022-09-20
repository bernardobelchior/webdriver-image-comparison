import { takeBase64Screenshot } from '../methods/screenshots';
import { makeCroppedBase64Image } from '../methods/images';
import beforeScreenshot from '../helpers/beforeScreenshot';
import afterScreenshot from '../helpers/afterScreenshot';
import { determineScreenRectangles } from '../methods/rectangles';
import { Methods } from '../methods/methods.interface';
import { Folders } from '../base.interface';
import { SaveScreenOptions } from './screen.interfaces';
import { BeforeScreenshotOptions, BeforeScreenshotResult } from '../helpers/beforeScreenshot.interface';
import { InstanceData } from '../methods/instanceData.interfaces';
import { AfterScreenshotOptions, ScreenshotOutput } from '../helpers/afterScreenshot.interfaces';
import { RectanglesOutput, ScreenRectanglesOptions } from '../methods/rectangles.interfaces';
import { determineIOSDeviceBezelCorners, determineIOSNotchData } from '../helpers/utils';

/**
 * Saves an image of the viewport of the screen
 */
export default async function saveScreen(
  methods: Methods,
  instanceData: InstanceData,
  folders: Folders,
  tag: string,
  saveScreenOptions: SaveScreenOptions,
): Promise<ScreenshotOutput> {
  // 1a. Set some variables
  const { addressBarShadowPadding, formatImageName, logLevel, savePerInstance, toolBarShadowPadding } = saveScreenOptions.wic;

  // 1b. Set the method options to the right values
  const disableCSSAnimation: boolean =
    'disableCSSAnimation' in saveScreenOptions.method
      ? saveScreenOptions.method.disableCSSAnimation
      : saveScreenOptions.wic.disableCSSAnimation;
  const hideScrollBars: boolean =
    'hideScrollBars' in saveScreenOptions.method ? saveScreenOptions.method.hideScrollBars : saveScreenOptions.wic.hideScrollBars;
  const hideElements: HTMLElement[] = saveScreenOptions.method.hideElements || [];
  const removeElements: HTMLElement[] = saveScreenOptions.method.removeElements || [];

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
  const enrichedInstanceData: BeforeScreenshotResult = await beforeScreenshot(methods.executor, beforeOptions);
  const devicePixelRatio = enrichedInstanceData.dimensions.window.devicePixelRatio;
  const isLandscape = enrichedInstanceData.dimensions.window.isLandscape;

  // 3.  Take the screenshot
  const base64Image: string = await takeBase64Screenshot(methods.screenShot);

  // Determine the rectangles
  const screenRectangleOptions: ScreenRectanglesOptions = {
    devicePixelRatio,
    innerHeight: enrichedInstanceData.dimensions.window.innerHeight,
    innerWidth: enrichedInstanceData.dimensions.window.innerWidth,
    isAndroidChromeDriverScreenshot: enrichedInstanceData.isAndroidChromeDriverScreenshot,
    isAndroidNativeWebScreenshot: enrichedInstanceData.isAndroidNativeWebScreenshot,
    isIos: enrichedInstanceData.isIos,
    isLandscape,
  };
  const rectangles: RectanglesOutput = determineScreenRectangles(base64Image, screenRectangleOptions);
  // NEW and BETA
  const bezelCornerRadius = enrichedInstanceData.isIos
    ? determineIOSDeviceBezelCorners({
        deviceName: enrichedInstanceData.deviceName,
        devicePixelRatio,
        height: enrichedInstanceData.dimensions.window.screenHeight,
        isLandscape,
        width: enrichedInstanceData.dimensions.window.screenWidth,
      })
    : 0;
  const notchData = enrichedInstanceData.isIos
    ? determineIOSNotchData({
        devicePixelRatio,
        height: enrichedInstanceData.dimensions.window.screenHeight,
        isLandscape,
        width: enrichedInstanceData.dimensions.window.screenWidth,
      })
    : { x: 0, y: 0, width: 0, height: 0 };
  // NEW and BETA
  // 4.  Make a cropped base64 image
  const croppedBase64Image: string = await makeCroppedBase64Image({
    base64Image,
    bezelCornerRadius,
    devicePixelRatio,
    isLandscape,
    logLevel,
    notchData,
    rectangles,
  });

  // 5.  The after the screenshot methods
  const afterOptions: AfterScreenshotOptions = {
    actualFolder: folders.actualFolder,
    base64Image: croppedBase64Image,
    disableCSSAnimation,
    filePath: {
      browserName: enrichedInstanceData.browserName,
      deviceName: enrichedInstanceData.deviceName,
      isMobile: enrichedInstanceData.isMobile,
      savePerInstance,
    },
    fileName: {
      browserName: enrichedInstanceData.browserName,
      browserVersion: enrichedInstanceData.browserVersion,
      deviceName: enrichedInstanceData.deviceName,
      devicePixelRatio,
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

  // 6.  Return the data
  return afterScreenshot(methods.executor, afterOptions);
}
