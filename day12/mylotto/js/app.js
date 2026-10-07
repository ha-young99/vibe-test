const MAX_NUMBER = 45;   // 로또 번호 범위 1~45
const PICK_COUNT = 6;    // 한 세트에 들어가는 번호 개수
const SET_COUNT = 5;     // 한 번에 생성하는 세트 수
const SET_LABELS = ["A", "B", "C", "D", "E"];

const fixedBoard = document.getElementById("fixedBoard");
const excludedBoard = document.getElementById("excludedBoard");
const fixedCount = document.getElementById("fixedCount");
const excludedCount = document.getElementById("excludedCount");
const fixedMessage = document.getElementById("fixedMessage");
const excludedMessage = document.getElementById("excludedMessage");
const generateBtn = document.getElementById("generateBtn");
const resetBtn = document.getElementById("resetBtn");
const clearResultBtn = document.getElementById("clearResultBtn");
const result = document.getElementById("result");

// 번호별 상태: "none"(기본) / "fixed"(고정) / "excluded"(제외)
// 번호를 그대로 인덱스로 쓰려고 0번 칸은 비워 둔다
const numberStates = new Array(MAX_NUMBER + 1).fill("none");

// 번호판 버튼 45개 만들기 (type: "fixed" 또는 "excluded")
function createBoard(board, type) {
    for (let number = 1; number <= MAX_NUMBER; number++) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = number;
        button.addEventListener("click", function () {
            toggleNumber(number, type);
        });
        board.append(button);
    }
}

// 해당 상태인 번호만 모아서 배열로 돌려준다
function getNumbers(state) {
    const numbers = [];
    for (let number = 1; number <= MAX_NUMBER; number++) {
        if (numberStates[number] === state) {
            numbers.push(number);
        }
    }
    return numbers;
}

function clearMessages() {
    fixedMessage.textContent = "";
    excludedMessage.textContent = "";
}

// 번호를 눌렀을 때: 선택 ↔ 해제
function toggleNumber(number, type) {
    clearMessages();

    if (numberStates[number] === type) {
        // 이미 선택된 번호를 다시 누르면 해제
        numberStates[number] = "none";
    } else if (type === "fixed" && getNumbers("fixed").length >= PICK_COUNT) {
        fixedMessage.textContent = "고정 번호는 6개까지 선택할 수 있어요.";
    } else if (type === "excluded" && MAX_NUMBER - getNumbers("excluded").length - 1 < PICK_COUNT) {
        excludedMessage.textContent = "남은 번호가 6개 이상이어야 해요.";
    } else {
        numberStates[number] = type;
    }

    renderBoards();
}

// 번호판 하나를 현재 상태에 맞게 다시 그린다
function renderBoard(board, type, selectedClass) {
    for (let number = 1; number <= MAX_NUMBER; number++) {
        const button = board.children[number - 1];
        const state = numberStates[number];

        if (state === type) {
            button.className = "btn " + selectedClass;
        } else {
            button.className = "btn btn-outline-secondary";
        }
        // 반대쪽 번호판에서 선택된 번호는 누를 수 없다
        button.disabled = state !== "none" && state !== type;
    }
}

function renderBoards() {
    renderBoard(fixedBoard, "fixed", "btn-primary");
    renderBoard(excludedBoard, "excluded", "btn-danger");
    fixedCount.textContent = getNumbers("fixed").length;
    excludedCount.textContent = getNumbers("excluded").length;
}

// 배열 순서를 무작위로 섞는다
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    return array;
}

// 한 세트 만들기: 고정 번호 + 나머지는 후보(기본 상태 번호)에서 랜덤
function makeSet() {
    const fixedNumbers = getNumbers("fixed");
    const candidates = shuffle(getNumbers("none"));
    const randomNumbers = candidates.slice(0, PICK_COUNT - fixedNumbers.length);
    const set = fixedNumbers.concat(randomNumbers);

    set.sort(function (a, b) {
        return a - b;
    });
    return set;
}

// 로또 공 하나의 HTML (번호대별로 색이 다르다)
function makeBall(number) {
    const colorIndex = Math.ceil(number / 10);
    return `<span class="ball ball-${colorIndex}">${number}</span>`;
}

function generate() {
    let html = "";

    for (let i = 0; i < SET_COUNT; i++) {
        const set = makeSet();
        const balls = set.map(makeBall).join("");
        // 복사할 글자는 버튼의 data-numbers 속성에 담아 둔다 (예: "1, 13, 18, 26, 34, 38")
        html += `
            <div class="result-row">
                <span class="result-label">${SET_LABELS[i]}</span>
                ${balls}
                <button type="button" class="copy-btn btn btn-outline-secondary btn-sm ms-auto"
                    data-numbers="${set.join(", ")}" title="번호 복사" aria-label="${SET_LABELS[i]}세트 번호 복사">
                    <i class="bi bi-clipboard"></i>
                </button>
            </div>`;
    }
    result.innerHTML = html;
    clearResultBtn.disabled = false;
}

// 생성 결과만 지운다 (고정/제외 선택은 그대로)
function showEmptyResult() {
    result.innerHTML = `<p class="text-secondary text-center mb-0 py-3">번호 생성 버튼을 눌러 주세요.</p>`;
    clearResultBtn.disabled = true;
}

// 글자를 클립보드에 복사한다. 성공하면 true, 실패하면 false
async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        // 클립보드 API를 못 쓰는 환경에서는 임시 입력칸을 만들어 복사한다
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.append(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        textarea.remove();
        return copied;
    }
}

// 결과 영역 안의 복사 버튼을 눌렀을 때
async function handleCopyClick(event) {
    const button = event.target.closest(".copy-btn");
    if (!button) {
        return;
    }

    const copied = await copyText(button.dataset.numbers);
    const icon = button.querySelector("i");

    // 1.5초 동안 성공(체크) 또는 실패(X) 표시를 보여 주고 원래대로 돌린다
    button.className = "copy-btn btn btn-sm ms-auto " + (copied ? "btn-success" : "btn-danger");
    icon.className = copied ? "bi bi-check-lg" : "bi bi-x-lg";
    setTimeout(function () {
        button.className = "copy-btn btn btn-outline-secondary btn-sm ms-auto";
        icon.className = "bi bi-clipboard";
    }, 1500);
}

function reset() {
    numberStates.fill("none");
    clearMessages();
    renderBoards();
    showEmptyResult();
}

generateBtn.addEventListener("click", generate);
resetBtn.addEventListener("click", reset);
clearResultBtn.addEventListener("click", showEmptyResult);
// 복사 버튼은 생성할 때마다 새로 만들어지므로, 바깥 결과 영역에서 클릭을 한 번에 받는다
result.addEventListener("click", handleCopyClick);

createBoard(fixedBoard, "fixed");
createBoard(excludedBoard, "excluded");
renderBoards();
showEmptyResult();
