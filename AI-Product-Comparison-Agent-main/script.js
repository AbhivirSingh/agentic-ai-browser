const puppeteer = require('puppeteer');
const { OpenAI } = require('openai');
const readline = require('readline');

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: "" // Ensure your API key is set in environment variables
});

// Set up readline for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Function to ask user questions
const askQuestion = (question) => {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
};

// Function to interact with GPT-4o-mini
async function getChatbotResponse(messages) {
    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: messages,
            temperature: 0.7,
        });
        return completion.choices[0].message.content;
    } catch (error) {
        console.error('Error with OpenAI API:', error);
        return 'Sorry, I encountered an error. Please try again.';
    }
}

// Function to perform login using Puppeteer
async function performLogin(url, username, password, usernameSelector, passwordSelector, submitSelector) {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    
    try {
        // Navigate to the webpage
        await page.goto(url, { waitUntil: 'networkidle2' });

        // Type credentials
        await page.type(usernameSelector, username);
        await page.type(passwordSelector, password);

        // Click submit button
        await page.click(submitSelector);
        
        // Wait for navigation or some indication of login success
        await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});

        // Check if login was successful (basic check for now)
        const currentUrl = page.url();
        console.log(`Navigated to: ${currentUrl}`);
        
        return { success: true, message: 'Login attempt completed', browser };
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, message: `Login failed: ${error.message}`, browser };
    }
}

// Main chatbot function
async function chatbot() {
    console.log('Welcome to the Web Login Chatbot! I can help you log in to websites.');
    
    const messages = [
        {
            role: 'system',
            content: 'You are a helpful chatbot that assists users in logging into websites. Ask for the website URL, username, password, and if necessary, the CSS selectors for the username field, password field, and submit button. If the user doesn’t provide selectors, suggest that you can try to infer them or ask for specific input. Be clear, concise, and guide the user step-by-step.'
        },
        {
            role: 'assistant',
            content: 'Please provide the URL of the website you want to log in to.'
        }
    ];

    while (true) {
        console.log(messages[messages.length - 1].content);
        const userInput = await askQuestion('');
        
        if (userInput.toLowerCase() === 'exit') {
            console.log('Goodbye!');
            rl.close();
            break;
        }

        messages.push({ role: 'user', content: userInput });

        // Get chatbot response
        const response = await getChatbotResponse(messages);
        console.log(response);
        messages.push({ role: 'assistant', content: response });

        // Check if we have enough information to attempt login
        if (response.includes('username') || response.includes('password')) {
            const urlMatch = userInput.match(/(https?:\/\/[^\s]+)/);
            if (urlMatch) {
                const url = urlMatch[0];
                
                // Ask for credentials and selectors
                console.log('Please provide your username:');
                const username = await askQuestion('');
                
                console.log('Please provide your password:');
                const password = await askQuestion('');
                
                console.log('Please provide the CSS selector for the username field (or press Enter to skip):');
                const usernameSelector = await askQuestion('') || 'input[name="username"], input[name="email"], input[type="text"]';
                
                console.log('Please provide the CSS selector for the password field (or press Enter to skip):');
                const passwordSelector = await askQuestion('') || 'input[name="password"], input[type="password"]';
                
                console.log('Please provide the CSS selector for the submit button (or press Enter to skip):');
                const submitSelector = await askQuestion('') || 'button[type="submit"], input[type="submit"], button:contains("Login"), button:contains("Sign In")';

                // Attempt login
                const result = await performLogin(url, username, password, usernameSelector, passwordSelector, submitSelector);
                console.log(result.message);
                
                // Close browser
                await result.browser.close();
                
                // Reset conversation
                messages.push({ role: 'assistant', content: 'Login attempt completed. Would you like to log in to another website?' });
            }
        }
    }
}

// Start the chatbot
chatbot().catch(console.error);