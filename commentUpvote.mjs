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
    log('Installing dependencies...');
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

async function focusNewestChromeWindow() {
    log('Focusing on the newest Chrome window...');
    const command = "xdotool search --onlyvisible --class 'google-chrome' | tail -1 | xargs xdotool windowactivate";
    await exec(command);
    log('Focused on the newest Chrome window');
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

async function checkForLoginText() {
  log('Checking for "Log in" text...');
  const command = `xdotool search --onlyvisible --class "google-chrome" windowactivate && xdotool key ctrl+a ctrl+c`;
  await exec(command);
  
  const clipboardContent = await exec('xclip -o -selection clipboard');
  const pageContent = clipboardContent.stdout.toLowerCase();
  
  if (pageContent.includes('log in')) {
    log('"Log in" text found on the page.');
    return true;
  } else {
    log('"Log in" text not found on the page.');
    return false;
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
  return Math.random() *  (1.5 - 0.5) + 0.5;
}

async function pressEnter() {
  await exec('xdotool key Return');
}

async function pressTabRandomly(times) {
  for (let i = 0; i < times; i++) {
    await exec('xdotool key Tab');
    await new Promise(resolve => setTimeout(resolve, randomDelay() * 1000));
  }
}

async function pressCtrlF() {
  log('Pressing Ctrl + F...');
  await focusNewestChromeWindow();
  await exec ('xdotool key ctrl+f')
  log('Ctrl + F pressed')
}

async function pressShiftTab(times = 1) {
    log(`Pressing Shift + Tab ${times} time(s)...`);
    await focusNewestChromeWindow();
    for (let i = 0; i < times; i++) {
      await exec('xdotool key shift+Tab');
      await new Promise(resolve => setTimeout(resolve, randomDelay() * 1000));
    }
    log(`Shift + Tab pressed ${times} time(s)`);
  }

async function typeText(text) {
  await exec(`xdotool type "${text}"`);
}

async function main() {
  try {
    log('Starting main automation function');

    // Ensure screenshots directory exists
    await fs.promises.mkdir('screenshots', { recursive: true });
    log(`Current working directory: ${process.cwd()}`);

    // Please put the comment link after the "--new-window" text in await exec. (the link given is just a test).
    log('Opening Chrome and navigating to Reddit Post...');
    await exec('google-chrome --new-window https://www.reddit.com/r/DotA2/comments/1dmkmhf/comment/l9w8h1t/?utm_source=share&utm_medium=web3x&utm_name=web3xcss&utm_term=1&utm_content=share_button');

    // Wait for 7-10 seconds before taking the first screenshot
    log('Waiting for 7-10 seconds before taking the first screenshot...');
    await new Promise(resolve => setTimeout(resolve, Math.random() * 3000 + 7000));

    // Take initial screenshot
    const screenshotNameInitial = `Upvote_initial_${new Date().toISOString().replace(/:/g, '-')}.png`;
    await takeScreenshot(screenshotNameInitial);

    log('Opening find dialog...');
    await pressCtrlF();

    // Wait a moment for the find dialog to open
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Now you can type what you want to search for
    await typeText('reply');

    await exec('xdotool key Escape');

    log('Moving focus backwards...');
    await pressShiftTab(2);

    // Press enter to upvote
    log('Upvoting..');
    await pressEnter();

    // Wait for 5-10 seconds to see if it worked
    log('Waiting for 5-10 seconds to make sure it worked...');
    await new Promise(resolve => setTimeout(resolve, Math.random() * 5000 + 5000));

    // Take final screenshot
    const screenshotNameFinal = `Upvote_final_${new Date().toISOString().replace(/:/g, '-')}.png`;
    log(`Final screenshot name: ${screenshotNameFinal}`);
    await takeScreenshot(screenshotNameFinal);

    log('Automation successful. Upvoted successfully.');
    return JSON.stringify({
      success: true,
      message: 'Upvoted Successfully',
      data: {
        visitedUrl: 'https://www.reddit.com/r/DotA2/comments/1dmkmhf/comment/l9w8h1t/?utm_source=share&utm_medium=web3x&utm_name=web3xcss&utm_term=1&utm_content=share_button',
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
    await focusNewestChromeWindow ();
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