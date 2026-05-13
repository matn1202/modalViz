import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTest() {
    console.log("Starting Vite dev server...");
    // Use 'npm run dev' to test the current source without rebuilding
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const server = spawn(npmCmd, ['run', 'dev'], { cwd: path.join(__dirname, '../..'), shell: true });
    
    // Wait a bit for server to start
    await new Promise(r => setTimeout(r, 4000));

    console.log("Launching browser...");
    const browser = await puppeteer.launch({ headless: "new", executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' });
    const page = await browser.newPage();
    
    try {
        await page.goto('http://localhost:5173');
        
        // Wait for file input to appear
        const fileInput = await page.waitForSelector('input[type="file"]');
        
        // Upload MockData.csv
        console.log("Uploading MockData.csv...");
        await fileInput.uploadFile(path.join(__dirname, 'MockData.csv'));
        
        // Wait for dropdowns
        console.log("Mapping columns...");
        await page.waitForSelector('select');
        const selects = await page.$$('select');
        const roles = ["Node ID", "X-Coordinate", "Y-Coordinate", "Z-Coordinate", "Frequency", "Modal Shape Value"];
        for (let i = 0; i < roles.length; i++) {
            await selects[i].select(roles[i]);
        }
        
        // Click process button
        console.log("Clicking process button...");
        await page.click('button');

        // Wait for canvas to appear
        console.log("Waiting for canvas...");
        const canvas = await page.waitForSelector('canvas');
        
        // Give it a moment to render the 3D scene
        await new Promise(r => setTimeout(r, 1000));
        
        console.log("Taking baseline screenshot...");
        const beforeBuffer = await canvas.screenshot();
        
        // Simulate drag
        console.log("Simulating drag to orbit...");
        const boundingBox = await canvas.boundingBox();
        const startX = boundingBox.x + boundingBox.width / 2;
        const startY = boundingBox.y + boundingBox.height / 2;
        
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        // Move mouse to drag
        await page.mouse.move(startX + 150, startY + 100, { steps: 15 });
        await page.mouse.up();
        
        // Give time for damping and re-render
        await new Promise(r => setTimeout(r, 500));
        
        console.log("Taking after-drag screenshot...");
        const afterBuffer = await canvas.screenshot();
        
        if (Buffer.compare(beforeBuffer, afterBuffer) === 0) {
            console.error("❌ TEST FAILED: Canvas did not change after drag. OrbitControls are not working.");
            process.exitCode = 1;
        } else {
            console.log("✅ TEST PASSED: Canvas changed after drag. OrbitControls are functioning.");
        }
    } catch (e) {
        console.error("Test error:", e);
        process.exitCode = 1;
    } finally {
        await browser.close();
        server.kill();
        process.exit(process.exitCode || 0);
    }
}

runTest();
