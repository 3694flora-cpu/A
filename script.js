// --- 遊戲常數 ---
const INITIAL_TIME = 60; 
const BONUS_SCORE_INTERVAL = 5; 
const HIGH_SCORE_KEY = 'batteryGameHighScore'; 
const SLOT_UPGRADE_THRESHOLD = 5; 
const BONUS_TIME = 5; 

// --- 模式開關 (預設普通模式) ---
let isHardMode = false; 

let correctCount = 0;
let draggedItem = null;
let timeLeft = INITIAL_TIME;
let timerInterval = null; 
let isGameActive = false; 
let lastBonusCount = 0; 
let currentHighScore = 0;
let slotsFilledCount = 0; 
let currentNumSlots = 1; 

// 模擬拖曳專用變數
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

// --- DOM 元素 ---
const slotsContainer = document.getElementById('slots-container'); 
const batteryContainer = document.getElementById('battery-container'); 
const correctCountSpan = document.getElementById('correct-count');
const timeRemainingSpan = document.getElementById('time-remaining'); 
const messageArea = document.getElementById('message-area');
const resetButton = document.getElementById('reset-button');
const highScoreSpan = document.getElementById('high-score');
const modeToggleButton = document.getElementById('mode-toggle-button'); 


// --- 輔助函數 ---

function loadHighScore() {
    const score = localStorage.getItem(HIGH_SCORE_KEY);
    currentHighScore = score ? parseInt(score, 10) : 0;
    if (highScoreSpan) highScoreSpan.textContent = currentHighScore;
}

function saveHighScore() {
    if (correctCount > currentHighScore) {
        currentHighScore = correctCount;
        localStorage.setItem(HIGH_SCORE_KEY, currentHighScore);
        if (highScoreSpan) highScoreSpan.textContent = currentHighScore;
        return true; 
    }
    return false; 
}

function showMessage(text, isSuccess) {
    if (messageArea) {
        messageArea.textContent = text;
        messageArea.style.color = isSuccess ? 'green' : 'red';
    }
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timeLeft = Math.max(0, timeLeft);
    if (timeRemainingSpan) timeRemainingSpan.textContent = timeLeft;
    if (timeRemainingSpan) timeRemainingSpan.classList.remove('time-low');

    timerInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft < 0) timeLeft = 0;
        if (timeRemainingSpan) timeRemainingSpan.textContent = timeLeft;
        if (timeLeft <= 10 && timeRemainingSpan) timeRemainingSpan.classList.add('time-low');

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            handleGameOver('timeup');
        }
    }, 1000);
}

function handleGameOver(reason) {
    isGameActive = false;
    if (timerInterval) clearInterval(timerInterval);

    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    if (batteryContainer) {
        batteryContainer.querySelectorAll('.battery').forEach(b => {
            b.removeEventListener('mousedown', handleMouseDown);
            b.style.cursor = 'default';
        });
    }

    if (reason !== 'mode_switch') {
        const isNewRecord = saveHighScore();
        let message = `✅ 時間到！您成功安裝了 ${correctCount} 個電池。挑戰結束！`;
        if (isNewRecord) message += ` 🏆 恭喜您打破紀錄！新紀錄是 ${currentHighScore}！`;
        else if (currentHighScore > 0) message += ` 您的最高紀錄是 ${currentHighScore}。`;
        showMessage(message, true);
    }
}

function checkForBonusTime() {
    const currentBonusMultiplier = Math.floor(correctCount / BONUS_SCORE_INTERVAL);
    if (currentBonusMultiplier > lastBonusCount) {
        timeLeft += BONUS_TIME;
        if (timeRemainingSpan) timeRemainingSpan.textContent = timeLeft;
        if (timeRemainingSpan) timeRemainingSpan.classList.remove('time-low');
        lastBonusCount = currentBonusMultiplier;
        showMessage(`🎉 時間獎勵 +${BONUS_TIME} 秒！您已成功安裝 ${correctCount} 個電池。`, true);
    }
}


// --- 模擬拖曳核心函數 ---

function handleMouseDown(e) {
    if (!isGameActive) return;
    if (e.button !== 0) return; 

    isDragging = true;
    draggedItem = e.target.closest('.battery'); 
    
    if (draggedItem) {
        draggedItem.classList.add('dragging'); 
        const rect = draggedItem.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
        draggedItem.style.cursor = 'grabbing';
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }
}

function handleMouseMove(e) {
    if (!isDragging || !draggedItem) return;
    e.preventDefault();
    draggedItem.style.left = (e.clientX - dragOffsetX) + 'px';
    draggedItem.style.top = (e.clientY - dragOffsetY) + 'px';
}

function handleMouseUp(e) {
    if (!isDragging || !draggedItem) return;
    isDragging = false;
    draggedItem.style.cursor = 'grab';
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    checkPlacement(e.clientX, e.clientY);
}

function resetBatteryPosition(batteryElement, message, isSuccess = false) {
    setTimeout(() => {
        batteryElement.classList.remove('dragging');
        batteryElement.style.left = ''; 
        batteryElement.style.top = ''; 
        batteryElement.style.opacity = '1';
        draggedItem = null;
    }, 50); 
    showMessage(message, isSuccess);
}

function anchorBatteryToSlot(batteryElement, targetSlot) {
    batteryElement.classList.remove('dragging');
    batteryElement.style.left = '';
    batteryElement.style.top = '';
    
    if (batteryContainer && batteryContainer.contains(batteryElement)) {
        batteryContainer.removeChild(batteryElement);
    }
    targetSlot.appendChild(batteryElement);

    batteryElement.style.position = 'static'; 
    batteryElement.style.width = '100%'; 
    batteryElement.style.height = '100%';
    
    batteryElement.removeEventListener('mousedown', handleMouseDown);
    batteryElement.style.cursor = 'default';
    
    targetSlot.classList.add('slot-filled');
}


function checkPlacement(dropX, dropY) {
    if (!draggedItem) return;

    const batteryRect = draggedItem.getBoundingClientRect();
    const batteryElement = draggedItem;
    
    const isReversed = batteryElement.classList.contains('battery-reversed'); 
    const batteryLeftPolarity = isReversed ? '-' : '+'; 

    const targetSlot = Array.from(slotsContainer.children).find(slot => {
        if (slot.classList.contains('slot-filled')) return false;

        const slotRect = slot.getBoundingClientRect();
        return (
            batteryRect.left < slotRect.right &&
            batteryRect.right > slotRect.left &&
            batteryRect.top < slotRect.bottom &&
            batteryRect.bottom > slotRect.top
        );
    });

    if (!targetSlot) {
        resetBatteryPosition(batteryElement, '請將電池拖曳到電池槽內！');
        return;
    }

    const requiredLeftPolarity = targetSlot.dataset.slotLeftPolarity;
    const isCorrectlyInstalled = (batteryLeftPolarity === requiredLeftPolarity);

    if (isCorrectlyInstalled) {
        correctCount++;
        if (correctCountSpan) correctCountSpan.textContent = correctCount; 
        
        checkForBonusTime(); 
        showMessage('✅ 安裝成功！', true);
       
        anchorBatteryToSlot(batteryElement, targetSlot);

        slotsFilledCount++;
        
        if (slotsFilledCount >= currentNumSlots) { 
             
             if (currentNumSlots === 1 && correctCount >= SLOT_UPGRADE_THRESHOLD) {
                 currentNumSlots = 2; 
                 showMessage(`🎉 恭喜！難度升級到 2 個槽位！準備下一輪...`, true);
             } else {
                 currentNumSlots = 2; // 雙槽位模式後保持 2 槽位
                 showMessage(`🎉 成功完成本輪 ${currentNumSlots} 個槽位！準備下一輪...`, true);
             }
             
             setTimeout(() => {
                resetForNextRound(); 
            }, 500); 
        } else {
             draggedItem = null;
             showMessage(`✅ 安裝成功！還剩下 ${currentNumSlots - slotsFilledCount} 個槽位。`, true);
        }

    } else {
        resetBatteryPosition(batteryElement, '❌ 選擇的電池方向錯誤，請選擇正確方向的電池！');
    }
}


// 輔助函數：創建電池 DOM 元素 (包含視覺結構)
function createBatteryElement(isReversed) {
    const newBattery = document.createElement('div');
    newBattery.className = 'battery';
    if (isReversed) {
        newBattery.classList.add('battery-reversed');
    }
    
    // 正極 Cap 容器
    const positiveCap = document.createElement('div');
    positiveCap.className = 'battery-cap positive-cap';
    
    // 正極視覺 Wrapper (用於顏色和符號)
    const positiveCapVisual = document.createElement('div');
    positiveCapVisual.className = 'battery-cap-visual-wrapper';
    positiveCapVisual.dataset.polarity = '+'; // 添加數據屬性用於 CSS content
    positiveCap.appendChild(positiveCapVisual);

    const label = document.createElement('div');
    label.className = 'battery-label';
    label.textContent = 'AA 電池';

    // 負極 Cap 容器
    const negativeCap = document.createElement('div');
    negativeCap.className = 'battery-cap negative-cap';
    
    // 負極視覺 Wrapper (用於顏色和符號)
    const negativeCapVisual = document.createElement('div');
    negativeCapVisual.className = 'battery-cap-visual-wrapper';
    negativeCapVisual.dataset.polarity = '-'; // 添加數據屬性用於 CSS content
    negativeCap.appendChild(negativeCapVisual);


    if (isReversed) {
        newBattery.appendChild(negativeCap);
        newBattery.appendChild(label);
        newBattery.appendChild(positiveCap);
    } else {
        newBattery.appendChild(positiveCap);
        newBattery.appendChild(label);
        newBattery.appendChild(negativeCap);
    }

    return newBattery;
}

// 輔助函數：創建電池槽 DOM 元素 (包含視覺結構)
function createSlotElement(slotIndex, forcedLeftPolarity = null) {
    let leftPolarity;
    
    if (forcedLeftPolarity) {
        leftPolarity = forcedLeftPolarity;
    } else {
        const isLeftPositive = Math.random() < 0.5; 
        leftPolarity = isLeftPositive ? '+' : '-';
    }

    const rightPolarity = leftPolarity === '+' ? '-' : '+'; 

    const slot = document.createElement('div');
    slot.className = 'slot-container';
    slot.dataset.slotLeftPolarity = leftPolarity; 
    slot.id = `slot-${slotIndex}`;

    const slotLeftEnd = document.createElement('div');
    const slotRightEnd = document.createElement('div');
    const slotBody = document.createElement('div');

    // 端點容器
    slotLeftEnd.className = 'slot-end';
    slotRightEnd.className = 'slot-end';

    // 實際視覺元素 (用於顏色/彈簧)
    const slotLeftEndVisual = document.createElement('div');
    slotLeftEndVisual.className = `slot-end-element-wrapper ${leftPolarity === '+' ? 'positive-end-visual' : 'negative-end-visual'}`;
    slotLeftEnd.appendChild(slotLeftEndVisual);

    const slotRightEndVisual = document.createElement('div');
    slotRightEndVisual.className = `slot-end-element-wrapper ${rightPolarity === '+' ? 'positive-end-visual' : 'negative-end-visual'}`;
    slotRightEnd.appendChild(slotRightEndVisual);
    
    // --- 模式視覺邏輯 ---
    if (isHardMode) {
        slotLeftEnd.classList.add('hard-mode');
        slotRightEnd.classList.add('hard-mode');
    } else {
        slotLeftEnd.classList.add('normal-mode');
        slotRightEnd.classList.add('normal-mode');
    }
    // --- 視覺邏輯結束 ---

    slotBody.className = 'slot-body';
    slotBody.textContent = `槽位 ${slotIndex + 1} / ${currentNumSlots}`; 

    slot.appendChild(slotLeftEnd);
    slot.appendChild(slotBody);
    slot.appendChild(slotRightEnd);
    
    return slot;
}


// 遊戲重置/生成下一輪邏輯
function resetForNextRound() {
    
    // 1. 清除舊槽位並生成新槽位
    if (slotsContainer) {
        slotsContainer.innerHTML = '';
        
        if (currentNumSlots === 2) { 
            const requiredPolarities = ['+', '-'];
            requiredPolarities.sort(() => Math.random() - 0.5); 
            
            const slot1 = createSlotElement(0, requiredPolarities[0]); 
            const slot2 = createSlotElement(1, requiredPolarities[1]); 
            
            slotsContainer.appendChild(slot1);
            slotsContainer.appendChild(slot2);

        } else {
            for (let i = 0; i < currentNumSlots; i++) {
                slotsContainer.appendChild(createSlotElement(i)); 
            }
        }
    }
    slotsFilledCount = 0; 

    // 2. 清除舊電池並生成**兩個**不同朝向的電池
    if (batteryContainer) {
        batteryContainer.innerHTML = ''; 
        draggedItem = null; 
    
        const battery1 = createBatteryElement(false); // 正常朝向 (+ -)
        const battery2 = createBatteryElement(true);  // 反轉朝向 (- +)
    
        batteryContainer.appendChild(battery1);
        initializeBatteryEvents(battery1);
        
        batteryContainer.appendChild(battery2);
        initializeBatteryEvents(battery2);
    }
    
    let modeText = isHardMode ? '【困難模式】' : '【普通模式】';
    let modeInstruction = isHardMode ? '請觀察電池凸起/平坦外觀與槽位彈簧/平坦結構！' : '請觀察電池與槽位的顏色提示！';
    showMessage(`${modeText} 新的挑戰開始！${modeInstruction}`, true);
}


// --- 模式切換函數 ---
function updateModeButtonText() {
    if (modeToggleButton) {
        modeToggleButton.textContent = isHardMode ? '切換至普通模式 (槽位有顏色)' : '切換至困難模式 (槽位現實外觀)';
    }
}

function toggleMode() {
    isHardMode = !isHardMode;
    updateModeButtonText(); 
    handleGameOver('mode_switch'); 
    resetGame();
}


// 核心重置函數 
function resetGame() {
    loadHighScore(); 
    isGameActive = true; 
    timeLeft = INITIAL_TIME;
    correctCount = 0;
    lastBonusCount = 0; 
    currentNumSlots = 1; 
    if (correctCountSpan) correctCountSpan.textContent = correctCount;
    
    resetForNextRound(); 
    startTimer(); 
    
    updateModeButtonText(); 
    
    let modeInstruction = isHardMode ? '請觀察電池凸起/平坦外觀與槽位彈簧/平坦結構！' : '請觀察電池與槽位的顏色提示！';
    showMessage(`遊戲開始！${modeInstruction}`, true);
}


// 初始化事件監聽器 (模擬拖曳)
function initializeBatteryEvents(batteryElement) {
    batteryElement.removeEventListener('mousedown', handleMouseDown);
    batteryElement.addEventListener('mousedown', handleMouseDown);
}


// 遊戲初始化
document.addEventListener('DOMContentLoaded', () => {
    resetGame(); 
    if (resetButton) resetButton.addEventListener('click', resetGame);
    if (modeToggleButton) modeToggleButton.addEventListener('click', toggleMode); 
});