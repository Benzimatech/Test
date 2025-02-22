// Configuration
const config = {
    rewards: {
        referrerReward: 1.0,      // Token reward for referring a new user
        newUserReward: 0.5,       // Token reward for new user using referral code
        minimumWithdrawal: 100,   // Minimum tokens for withdrawal
        maximumWithdrawal: 100000 // Maximum tokens for withdrawal
    },
    tasks: [
        {
            id: 'telegram',
            title: 'Join Telegram Channel',
            description: 'Subscribe to our Telegram Channel',
            reward: 0.05,
            url: 'https://t.me/telegramchannel',
            type: 'link'
        }
        // Add more tasks here
    ],
    admins: ['admin1', 'admin2'], // List of admin usernames
    github: {
        owner: 'Benzimatech',
        repo: 'Data',
        path: 'database.json',
        token: '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' // Replace with actual token
    }
};

// Global Variables
let currentUser = null;
let database = null;

// Utility Functions
function showAlert(message) {
    const alert = document.getElementById('custom-alert');
    const alertMessage = document.getElementById('alert-message');
    alertMessage.textContent = message;
    alert.classList.remove('hidden');
}

function closeAlert() {
    document.getElementById('custom-alert').classList.add('hidden');
}

function setCookie(name, value, days) {
    const encryptedValue = btoa(value); // Simple base64 encryption
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${encryptedValue};expires=${expires.toUTCString()};path=/`;
}

function getCookie(name) {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        const [cookieName, cookieValue] = cookie.split('=').map(c => c.trim());
        if (cookieName === name) {
            return atob(cookieValue); // Decrypt base64
        }
    }
    return null;
}

async function fetchDatabase() {
    try {
        const response = await fetch(`https://api.github.com/repos/${config.github.owner}/${config.github.repo}/contents/${config.github.path}`, {
            headers: {
                'Authorization': `token ${config.github.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                // Create new database if it doesn't exist
                return initializeDatabase();
            }
            throw new Error('Failed to fetch database');
        }

        const data = await response.json();
        const content = atob(data.content);
        database = JSON.parse(content);
        return database;
    } catch (error) {
        console.error('Error fetching database:', error);
        return initializeDatabase();
    }
}

async function updateDatabase() {
    try {
        const content = JSON.stringify(database, null, 2);
        const encodedContent = btoa(content);

        // Get current file to get its SHA
        const currentFile = await fetch(`https://api.github.com/repos/${config.github.owner}/${config.github.repo}/contents/${config.github.path}`, {
            headers: {
                'Authorization': `token ${config.github.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        }).then(res => res.json());

        const response = await fetch(`https://api.github.com/repos/${config.github.owner}/${config.github.repo}/contents/${config.github.path}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${config.github.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'Update database',
                content: encodedContent,
                sha: currentFile.sha
            })
        });

        if (!response.ok) {
            throw new Error('Failed to update database');
        }
    } catch (error) {
        console.error('Error updating database:', error);
        showAlert('Failed to update database. Please try again.');
    }
}

function initializeDatabase() {
    return {
        users: {},
        withdrawals: [],
        totalTokens: 0,
        totalWithdrawals: 0,
        completedWithdrawals: 0,
        incompleteWithdrawals: 0
    };
}

// Authentication Functions
async function login(username, password) {
    await fetchDatabase();
    const user = database.users[username];
    
    if (!user || user.password !== password) {
        showAlert('Invalid username or password');
        return false;
    }

    currentUser = username;
    setCookie('username', username, 7);
    setCookie('password', password, 7);
    showMainApp();
    return true;
}

async function register(username, password, referralCode) {
    await fetchDatabase();
    
    if (database.users[username]) {
        showAlert('Username already exists');
        return false;
    }
    
    if (!isValidPassword(password)) {
        showAlert('Password must be at least 8 characters long and include both numbers and letters');
        return false;
    }

    const newUser = {
        password: password,
        balance: 0,
        referralCode: generateReferralCode(),
        referralCount: 0,
        referralHistory: [],
        completedTasks: [],
        withdrawalHistory: []
    };

    if (referralCode) {
        const referrer = Object.entries(database.users).find(([_, user]) => user.referralCode === referralCode);
        if (referrer) {
            const [referrerUsername, referrerUser] = referrer;
            // Reward referrer
            referrerUser.balance += config.rewards.referrerReward;
            referrerUser.referralCount += 1;
            referrerUser.referralHistory.push(username);
            // Reward new user
            newUser.balance += config.rewards.newUserReward;
        }
    }

    database.users[username] = newUser;
    await updateDatabase();
    
    currentUser = username;
    setCookie('username', username, 7);
    setCookie('password', password, 7);
    showMainApp();
    return true;
}

function isValidPassword(password) {
    const hasNumber = /\d/;
    const hasLetter = /[a-zA-Z]/;
    return password.length >= 8 && hasNumber.test(password) && hasLetter.test(password);
}

function generateReferralCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// UI Functions
function showMainApp() {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('app-sections').classList.remove('hidden');
    updateUI();
}

function updateUI() {
    const user = database.users[currentUser];
    
    // Update user info
    document.getElementById('username-display').textContent = currentUser;
    document.getElementById('balance-display').textContent = user.balance.toFixed(2);
    
    // Update referral info
    document.getElementById('referral-code').textContent = user.referralCode;
    document.getElementById('referral-count').textContent = user.referralCount;
    
    // Update tasks
    updateTasksUI();
    
    // Update withdrawal history
    updateWithdrawalHistory();
    
    // Update admin section if applicable
    if (config.admins.includes(currentUser)) {
        document.getElementById('admin-section').classList.remove('hidden');
        updateAdminUI();
    }
    
    // Update leaderboard
    updateLeaderboard();
}

function updateTasksUI() {
    const tasksContainer = document.getElementById('tasks-container');
    const user = database.users[currentUser];
    
    tasksContainer.innerHTML = '';
    config.tasks.forEach(task => {
        const isCompleted = user.completedTasks.includes(task.id);
        const taskElement = document.createElement('div');
        taskElement.className = 'task-card';
        taskElement.innerHTML = `
            <h3>${task.title}</h3>
            <p>${task.description}</p>
            <p>Reward: ${task.reward} tokens</p>
            ${isCompleted ? 
                '<button disabled>Completed</button>' : 
                `<button onclick="completeTask('${task.id}')">Complete Task</button>`}
        `;
        tasksContainer.appendChild(taskElement);
    });
}

async function completeTask(taskId) {
    const user = database.users[currentUser];
    const task = config.tasks.find(t => t.id === taskId);
    
    if (!user.completedTasks.includes(taskId)) {
        // Redirect to task URL
        window.location.href = task.url;
        
        // Wait for 15 seconds
        setTimeout(async () => {
            user.completedTasks.push(taskId);
            user.balance += task.reward;
            database.totalTokens += task.reward;
            await updateDatabase();
            updateUI();
            showAlert(`Congratulations! You earned ${task.reward} tokens`);
        }, 15000);
    }
}

async function submitWithdrawal(userId, amount, password) {
    const user = database.users[currentUser];
    
    if (password !== user.password) {
        showAlert('Invalid password');
        return;
    }
    
    if (amount < config.rewards.minimumWithdrawal || amount > config.rewards.maximumWithdrawal) {
        showAlert(`Withdrawal amount must be between ${config.rewards.minimumWithdrawal} and ${config.rewards.maximumWithdrawal} tokens`);
        return;
    }
    
    if (amount > user.balance) {
        showAlert('Insufficient balance');
        return;
    }
    
    const withdrawal = {
    id: Date.now(),
    username: currentUser,
    userId: userId,
    amount: amount,
    status: 'pending',
    timestamp: new Date().toISOString()
};

database.withdrawals.push(withdrawal);
user.withdrawalHistory.push(withdrawal);
user.balance -= amount;
database.totalTokens -= amount;
database.totalWithdrawals += 1;
database.incompleteWithdrawals += 1;

await updateDatabase();
updateUI();
showAlert('Withdrawal request submitted successfully');
}

function updateAdminUI() {
    // Update statistics
    document.getElementById('total-users').textContent = Object.keys(database.users).length;
    document.getElementById('active-users').textContent = Object.keys(database.users).length; // Add actual active user logic if needed
    document.getElementById('total-tokens').textContent = database.totalTokens.toFixed(2);
    
    // Update withdrawal requests
    updateWithdrawalRequests();
    
    // Update top users
    updateTopUsers();
}

function updateWithdrawalRequests() {
    const container = document.getElementById('withdrawal-requests-list');
    const dateFilter = document.getElementById('withdrawal-date-filter').value;
    
    let filteredWithdrawals = database.withdrawals.filter(w => w.status === 'pending');
    if (dateFilter) {
        filteredWithdrawals = filteredWithdrawals.filter(w => 
            w.timestamp.startsWith(dateFilter)
        );
    }
    
    container.innerHTML = filteredWithdrawals.map(w => `
        <div class="withdrawal-request">
            <p>User: ${w.username}</p>
            <p>Wallet ID: ${w.userId}</p>
            <p>Amount: ${w.amount} tokens</p>
            <button onclick="completeWithdrawal(${w.id})">Mark as Completed</button>
        </div>
    `).join('');
}

async function completeWithdrawal(withdrawalId) {
    const withdrawal = database.withdrawals.find(w => w.id === withdrawalId);
    if (withdrawal) {
        withdrawal.status = 'completed';
        database.completedWithdrawals += 1;
        database.incompleteWithdrawals -= 1;
        
        const user = database.users[withdrawal.username];
        const userWithdrawal = user.withdrawalHistory.find(w => w.id === withdrawalId);
        if (userWithdrawal) {
            userWithdrawal.status = 'completed';
        }
        
        await updateDatabase();
        updateAdminUI();
        showAlert('Withdrawal marked as completed');
    }
}

function updateTopUsers() {
    // Sort users by token balance
    const topTokenUsers = Object.entries(database.users)
        .sort(([, a], [, b]) => b.balance - a.balance)
        .slice(0, 3);
    
    // Sort users by referral count
    const topReferralUsers = Object.entries(database.users)
        .sort(([, a], [, b]) => b.referralCount - a.referralCount)
        .slice(0, 3);
    
    document.getElementById('top-token-users').innerHTML = topTokenUsers.map(([username, user], index) => `
        <p>${index + 1}. ${username}: ${user.balance.toFixed(2)} tokens</p>
    `).join('');
    
    document.getElementById('top-referral-users').innerHTML = topReferralUsers.map(([username, user], index) => `
        <p>${index + 1}. ${username}: ${user.referralCount} referrals</p>
    `).join('');
}

function updateLeaderboard() {
    const tokenLeaderboard = Object.entries(database.users)
        .sort(([, a], [, b]) => b.balance - a.balance)
        .slice(0, 100);
    
    const referralLeaderboard = Object.entries(database.users)
        .sort(([, a], [, b]) => b.referralCount - a.referralCount)
        .slice(0, 100);
    
    document.getElementById('token-leaderboard').innerHTML = tokenLeaderboard.map(([username, user], index) => `
        <div class="leaderboard-entry">
            <span>${index + 1}.</span>
            <span>${username}</span>
            <span>${user.balance.toFixed(2)} tokens</span>
        </div>
    `).join('');
    
    document.getElementById('referral-leaderboard').innerHTML = referralLeaderboard.map(([username, user], index) => `
        <div class="leaderboard-entry">
            <span>${index + 1}.</span>
            <span>${username}</span>
            <span>${user.referralCount} referrals</span>
        </div>
    `).join('');
}

function updateWithdrawalHistory() {
    const user = database.users[currentUser];
    const container = document.getElementById('withdrawal-history');
    
    container.innerHTML = user.withdrawalHistory.map(w => `
        <div class="withdrawal-entry">
            <p>Amount: ${w.amount} tokens</p>
            <p>Status: <span class="status-${w.status}">${w.status}</span></p>
            <p>Date: ${new Date(w.timestamp).toLocaleDateString()}</p>
        </div>
    `).join('');
}

// Navigation Functions
function switchSection(section) {
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById(`${section}-section`).classList.remove('hidden');
    document.querySelector(`[onclick="switchSection('${section}')"]`).classList.add('active');
}

function switchAuthTab(tab) {
    document.querySelectorAll('.auth-form').forEach(form => form.classList.add('hidden'));
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    
    document.getElementById(`${tab}-form`).classList.remove('hidden');
    document.querySelector(`[onclick="switchAuthTab('${tab}')"]`).classList.add('active');
}

function switchLeaderboardTab(tab) {
    document.getElementById('token-leaderboard').classList.toggle('hidden', tab !== 'tokens');
    document.getElementById('referral-leaderboard').classList.toggle('hidden', tab !== 'referrals');
    document.querySelectorAll('.leaderboard-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[onclick="switchLeaderboardTab('${tab}')"]`).classList.add('active');
}

// Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
    // Check for saved login
    const savedUsername = getCookie('username');
    const savedPassword = getCookie('password');
    if (savedUsername && savedPassword) {
        await login(savedUsername, savedPassword);
    }
    
    // Login form submission
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        await login(username, password);
    });
    
    // Register form submission
    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('register-username').value;
        const password = document.getElementById('register-password').value;
        const referralCode = document.getElementById('register-referral').value;
        await register(username, password, referralCode);
    });
    
    // Withdrawal form submission
    document.getElementById('withdrawal-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const userId = document.getElementById('wallet-userid').value;
        const amount = parseFloat(document.getElementById('withdrawal-amount').value);
        const password = document.getElementById('withdrawal-password').value;
        await submitWithdrawal(userId, amount, password);
    });
    
    // Date filter for withdrawal requests
    document.getElementById('withdrawal-date-filter').addEventListener('change', () => {
        if (config.admins.includes(currentUser)) {
            updateWithdrawalRequests();
        }
    });
});

// Copy referral code to clipboard
function copyReferralCode() {
    const referralCode = document.getElementById('referral-code').textContent;
    navigator.clipboard.writeText(referralCode)
        .then(() => showAlert('Referral code copied to clipboard!'))
        .catch(() => showAlert('Failed to copy referral code'));
}

// Error handling for database operations
window.onerror = function(message, source, lineno, colno, error) {
    console.error('Global error:', error);
    showAlert('An error occurred. Please try again later.');
    return false;
};

// Periodic UI updates (every 30 seconds)
setInterval(() => {
    if (currentUser) {
        fetchDatabase().then(() => updateUI());
    }
}, 30000);