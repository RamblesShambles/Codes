import { writeFile, readFile, access } from 'fs/promises';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCallback);

function log(message) {
  console.log(JSON.stringify({ log: message }));
}

async function installDependencies() {
  try {
    log('Checking for xdotool...');
    try {
      execSync('which xdotool');
      log('xdotool is already installed');
    } catch (error) {
      log('xdotool not found. Installing xdotool...');
      execSync('sudo apt-get update && sudo apt-get install -y xdotool', { stdio: 'inherit' });
      log('xdotool installed successfully');
    }

    log('Checking for xclip...');
    try {
      execSync('which xclip');
      log('xclip is already installed');
    } catch (error) {
      log('xclip not found. Installing xclip...');
      execSync('sudo apt-get update && sudo apt-get install -y xclip', { stdio: 'inherit' });
      log('xclip installed successfully');
    }

    log('Installing npm dependencies...');
    execSync('npm install playwright@latest pixelmatch pngjs', { stdio: 'inherit' });
    log('Installing Playwright browsers...');
    execSync('npx playwright install chromium', { stdio: 'inherit' });
    log('Dependencies and Playwright browsers installed successfully');
    return true;
  } catch (error) {
    log(`Error installing dependencies: ${error.message}`);
    return false;
  }
}

async function checkForLoginText() {
  log('Checking for "Log in" text...');
  await focusNewestChromeWindow();
  const command = `xdotool key ctrl+a ctrl+c`;
  await exec(command);
  
  const clipboardContent = await exec('xclip -o -selection clipboard');
  const pageContent = clipboardContent.stdout.toLowerCase();
  
  log(`Page content (first 100 chars): ${pageContent.substring(0, 100)}...`);

  if (pageContent.includes('log in')) {
    log('"Log in" text found on the page.');
    return true;
  } else {
    log('"Log in" text not found on the page.');
    return false;
  }
}

async function takeScreenshot(filename) {
  const fullPath = `screenshots/${filename}`;
  const command = `import -window root ${fullPath}`;
  await exec(command);
  
  // Verify file exists
  try {
    await access(fullPath);
    log(`Screenshot saved and verified: ${fullPath}`);
  } catch (error) {
    log(`Error: Screenshot file not found after saving: ${fullPath}`);
    throw error;
  }
}

async function compareScreenshots(originalScreenshot, currentScreenshot) {
  log(`Comparing screenshots: ${originalScreenshot} vs ${currentScreenshot}`);
  const originalBuffer = await readFile(originalScreenshot.startsWith('screenshots/') ? originalScreenshot : `screenshots/${originalScreenshot}`);
  const currentBuffer = await readFile(currentScreenshot.startsWith('screenshots/') ? currentScreenshot : `screenshots/${currentScreenshot}`);
  const originalPng = PNG.sync.read(originalBuffer);
  const currentPng = PNG.sync.read(currentBuffer);
  const { width, height } = originalPng;
  const diff = new PNG({ width, height });
  const mismatchedPixels = pixelmatch(
    originalPng.data,
    currentPng.data,
    diff.data,
    width,
    height,
    { threshold: 0.1 }
  );
  const mismatchPercentage = (mismatchedPixels / (width * height)) * 100;
  const similarity = 100 - mismatchPercentage;
  log(`Screenshot comparison result: ${similarity}% similar`);
  return similarity >= 90;
}

function randomDelay() {
  return Math.random() * (1.5 - 0.5) + 0.5;
}

async function pressEnter() {
  await focusNewestChromeWindow();
  await exec('xdotool key Return');
}

async function pressTabRandomly(times) {
  await focusNewestChromeWindow();
  for (let i = 0; i < times; i++) {
    await exec('xdotool key Tab');
    await new Promise(resolve => setTimeout(resolve, randomDelay() * 1000));
  }
}

async function openChrome() {
  log('Opening new Chrome window...');
  const command = 'google-chrome --new-window https://www.reddit.com/r/memes/submit';
  const { stdout, stderr } = await exec(command);
  log(`Chrome opened. stdout: ${stdout}, stderr: ${stderr}`);
  return new Promise(resolve => setTimeout(() => resolve(), 5000)); // Wait for 5 seconds after opening
}

async function focusNewestChromeWindow() {
  log('Focusing on the newest Chrome window...');
  const command = "xdotool search --onlyvisible --class 'google-chrome' | tail -1 | xargs xdotool windowactivate";
  await exec(command);
  log('Focused on the newest Chrome window');
}

async function typeText(text) {
  await focusNewestChromeWindow();
  await exec(`xdotool type "${text}"`);
}

async function main() {
  try {
    log('Starting main automation function');
    log(`Current working directory: ${process.cwd()}`);

    await fs.promises.mkdir('screenshots', { recursive: true });

    await openChrome();

    log('Waiting for 7-10 seconds before checking for login...');
    await new Promise(resolve => setTimeout(resolve, Math.random() * 3000 + 7000));

    const loginRequired = await checkForLoginText();
    if (loginRequired) {
      log('Login required. Please log in manually and run the script again.');
      return JSON.stringify({
        success: false,
        message: 'Login required. Please log in manually and run the script again.',
        data: null,
        screenshotPaths: [],
      });
    }

    log('Login not required. Proceeding with automation...');

    // Take initial screenshot
    const screenshotNameInitial = `screenshot_initial_${new Date().toISOString().replace(/:/g, '-')}.png`;
    await takeScreenshot(screenshotNameInitial);

    // Check if baseline initial screenshot exists
    const baselineInitialExists = fs.existsSync('screenshots/baseline_initial.png');

    if (baselineInitialExists) {
      // Compare initial screenshot with baseline initial screenshot
      log('Comparing initial screenshot with baseline initial screenshot...');
      const isSimilarInitial = await compareScreenshots('baseline_initial.png', screenshotNameInitial);
      if (!isSimilarInitial) {
        throw new Error('Initial screenshot comparison failed. The page might not have loaded correctly.');
      }
    } else {
      // Save the initial screenshot as baseline
      await writeFile(`screenshots/baseline_initial.png`, await readFile(`screenshots/${screenshotNameInitial}`));
      log('Saved initial screenshot as baseline.');
    }

    await focusNewestChromeWindow(); // Ensure focus before interacting
    log('Pressing Tab 18 times...');
    await pressTabRandomly(18);

    // Fill the title box
    log('Filling the title box...');
    await typeText('this is the title part, just a test run!');

    // Press Tab 2 times randomly
    log('Pressing Tab 2 times...');
    await pressTabRandomly(2);

    // Fill the body part
    log('Filling the body part...');
    await typeText('This is the body part of the post, this subject is just a test123445!');

    // Press Tab 4 times randomly
    log('Pressing Tab 4 times...');
    await pressTabRandomly(4);

    // Press enter to submit your post
    log('Submitting your post...');
    await pressEnter();

    // Wait for 7-10 seconds after submitting the post
    log('Waiting for 7-10 seconds after submitting the post...');
    await new Promise(resolve => setTimeout(resolve, Math.random() * 3000 + 7000));

    // Take final screenshot
    const screenshotNameFinal = `screenshot_final_${new Date().toISOString().replace(/:/g, '-')}.png`;
    log(`Final screenshot name: ${screenshotNameFinal}`);
    await takeScreenshot(screenshotNameFinal);

    // Check if baseline final screenshot exists
    const baselineFinalExists = fs.existsSync('screenshots/baseline_final.png');

    if (baselineFinalExists) {
      // Compare final screenshot with baseline final screenshot
      log('Comparing final screenshot with baseline final screenshot...');
      const isSimilarFinal = await compareScreenshots('baseline_final.png', `screenshots/${screenshotNameFinal}`);
      if (!isSimilarFinal) {
        throw new Error('Final screenshot comparison failed. The post might not have been submitted correctly.');
      }
    } else {
      // Save the final screenshot as baseline
      await writeFile(`screenshots/baseline_final.png`, await readFile(`screenshots/${screenshotNameFinal}`));
      log('Saved final screenshot as baseline.');
    }

    log('Automation successful. Post submitted successfully.');
    return JSON.stringify({
      success: true,
      message: 'Post submitted successfully.',
      data: {
        visitedUrl: 'https://www.reddit.com/r/memes/submit',
        currentTime: new Date().toISOString(),
      },
      screenshotPaths: [`screenshots/${screenshotNameInitial}`, `screenshots/${screenshotNameFinal}`],
    });

  } catch (error) {
    log(`Automation error: ${error.message}`);
    log(`Error stack: ${error.stack}`);
    return JSON.stringify({
      success: false,
      message: 'An error occurred during automation.',
      data: null,
      error: error.message,
      stack: error.stack,
      screenshotPaths: [],
    });
  } finally {
    log('Closing browser');
    await focusNewestChromeWindow();
    await exec('xdotool search --onlyvisible --class "google-chrome" windowactivate key --clearmodifiers ctrl+w');
    log('Browser closed');
  }
}

log('Starting automation script');
main()
  .then(result => {
    log('Automation script completed');
    console.log(result);
  })
  .catch(error => {
    log(`Unhandled error in main: ${error.message}`);
    log(`Unhandled error stack: ${error.stack}`);
    console.error(JSON.stringify({
      success: false,
      message: 'Unhandled error: ' + error.message,
      data: null,
      stack: error.stack
    }));
  });