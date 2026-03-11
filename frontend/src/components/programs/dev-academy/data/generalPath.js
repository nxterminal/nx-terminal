export const GENERAL_PATH = {
  id: "general",
  name: "Dev Fundamentals",
  icon: "< >",
  description: "Learn to code from zero. Variables, logic, functions, and beyond.",
  modules: [
    {
      id: "m1", title: "Variables & Types", corp: "closedai",
      lessons: [
        {
          id: "l1", type: "concept", title: "What is a Variable?",
          steps: [
            {
              title: "Think of a labeled box",
              blocks: [
                { type: "text", content: "A variable is a container that holds a value. Imagine a box with a label on it — you put something inside, and later you can look at the label to find what you stored." },
                { type: "highlight", content: "In programming, variables let you store and reuse data throughout your code." },
              ],
            },
            {
              title: "Creating variables in JavaScript",
              blocks: [
                { type: "text", content: "In JavaScript, you create a variable using the 'let' keyword, followed by a name and a value:" },
                { type: "code", label: "Declaring variables", content: 'let playerName = "DevFrog";\nlet health = 100;\nlet isAlive = true;' },
                { type: "list", items: [
                  "'let' tells JavaScript you want to create a variable",
                  "'=' assigns a value to it (it does NOT mean 'equals' like in math)",
                  "The name on the left is the label, the value on the right is what goes in the box",
                ] },
              ],
            },
            {
              title: "Using your variables",
              blocks: [
                { type: "text", content: "Once a variable exists, you can read it, change it, or combine it with others:" },
                { type: "code", content: 'let score = 10;\nscore = score + 5;  // Now score is 15\n\nlet name = "Dev";\nlet greeting = "Hello, " + name;  // "Hello, Dev"' },
                { type: "warn", content: "Variable names are case-sensitive: 'Score' and 'score' are two different variables." },
              ],
            },
          ],
          question: "Which line correctly declares a variable with the value 42?",
          options: ["let answer = 42;", "variable answer = 42;", "answer := 42;", "set answer to 42;"],
          correct: 0, xp: 10,
          explanation: "'let' is the keyword to declare variables in JavaScript. The syntax is: let name = value;",
        },
        {
          id: "l1b", type: "fill-blank", title: "Complete the Variables",
          prompt: "Fill in the blanks to declare three different variables:",
          code: 'let username = ___;\nlet level = ___;\nlet isOnline = ___;',
          blanks: [
            { answer: '"DevFrog"', placeholder: 'a string', explanation: "Strings are text wrapped in quotes" },
            { answer: "1", placeholder: 'a number', explanation: "Numbers are written without quotes" },
            { answer: "true", placeholder: 'true/false', explanation: "Booleans are either true or false" },
          ],
          xp: 10,
        },
        {
          id: "l2", type: "code", title: "Declare Variables",
          prompt: "Create a variable called 'devCount' and set it to 35000",
          starter: "// Declare your variable below\n",
          solution: "let devCount = 35000;",
          hint: "Use 'let' followed by the variable name, then '=' and the value", xp: 15,
        },
        {
          id: "l3", type: "concept", title: "Data Types",
          steps: [
            {
              title: "Every value has a type",
              blocks: [
                { type: "text", content: "Just like real life has different kinds of things (numbers, text, yes/no answers), JavaScript organizes values into types. The type determines what you can do with the value." },
              ],
            },
            {
              title: "The five basic types",
              blocks: [
                { type: "code", label: "JavaScript data types", content: 'let name = "NX Terminal";  // String — text\nlet devs = 35000;           // Number — numeric value\nlet isLive = true;          // Boolean — true or false\nlet rewards = null;         // Null — intentionally empty\nlet future;                 // Undefined — not yet assigned' },
                { type: "list", items: [
                  "Strings hold text — always wrapped in quotes (single or double)",
                  "Numbers hold numeric values — no quotes needed",
                  "Booleans are yes/no flags — only 'true' or 'false'",
                  "Null means 'deliberately nothing'",
                  "Undefined means 'not set yet'",
                ] },
              ],
            },
            {
              title: "Why types matter",
              blocks: [
                { type: "text", content: "Types matter because they change how operators work:" },
                { type: "code", content: '// Number + Number = addition\n5 + 3           // 8\n\n// String + String = concatenation\n"Dev" + "#42"   // "Dev#42"\n\n// Number + String = string!\n"Dev #" + 42    // "Dev #42"' },
                { type: "highlight", content: "When you add a number to a string, JavaScript converts the number to text and joins them together." },
              ],
            },
          ],
          question: "What data type is the value 'true'?",
          options: ["String", "Number", "Boolean", "Null"],
          correct: 2, xp: 10,
          explanation: "'true' and 'false' are Boolean values — they represent yes/no, on/off states.",
        },
        {
          id: "l3b", type: "output-predict", title: "Predict the Output",
          code: 'let x = 10;\nlet y = "5";\nconsole.log(x + y);',
          options: ['"105"', "15", '"x + y"', "Error"],
          correct: 0,
          explanation: "When you add a number to a string, JavaScript converts the number to a string and concatenates them. 10 becomes '10', then '10' + '5' = '105'.",
          trace: [
            "x is set to the number 10",
            "y is set to the string '5' (note the quotes)",
            "x + y: JavaScript sees a string, converts 10 to '10'",
            "Result: '10' + '5' = '105' (string concatenation)",
          ],
          xp: 10,
        },
        {
          id: "l4", type: "code", title: "String Operations",
          prompt: 'Create a variable "greeting" that combines "Hello, " with "Dev #1337" using the + operator',
          starter: "// Combine the strings\nlet greeting = ",
          solution: 'let greeting = "Hello, " + "Dev #1337";',
          hint: "Use the + operator to concatenate two strings", xp: 15,
        },
      ],
    },
    {
      id: "m2", title: "Control Flow", corp: "shallowmind",
      lessons: [
        {
          id: "l5", type: "concept", title: "If/Else Statements",
          steps: [
            {
              title: "Making decisions in code",
              blocks: [
                { type: "text", content: "Programs need to make decisions. 'Should I show an error? Is the user logged in? Did they win?' These decisions use if/else statements." },
                { type: "highlight", content: "An if statement runs a block of code ONLY when a condition is true." },
              ],
            },
            {
              title: "Basic if statement",
              blocks: [
                { type: "code", label: "The simplest decision", content: 'let nftCount = 3;\n\nif (nftCount > 0) {\n  console.log("You own NFTs!");\n}' },
                { type: "text", content: "The condition (nftCount > 0) is checked. Since 3 > 0 is true, the code inside the { } runs." },
              ],
            },
            {
              title: "Adding else and else if",
              blocks: [
                { type: "text", content: "You can chain multiple conditions. The code checks top-to-bottom and runs the FIRST match:" },
                { type: "code", content: 'let devRank = 5;\n\nif (devRank >= 10) {\n  console.log("Senior Dev!");\n} else if (devRank >= 5) {\n  console.log("Mid Dev");\n} else {\n  console.log("Junior Dev");\n}' },
                { type: "text", content: "Here: devRank is 5. Is 5 >= 10? No. Is 5 >= 5? Yes! So 'Mid Dev' is printed. The else block is skipped." },
              ],
            },
            {
              title: "Comparison operators",
              blocks: [
                { type: "code", label: "All comparison operators", content: 'a === b   // Equal to (strict)\na !== b   // Not equal to\na > b     // Greater than\na < b     // Less than\na >= b    // Greater or equal\na <= b    // Less or equal' },
                { type: "warn", content: "Use === (triple equals) for comparison, NOT = (single equals). Single = assigns a value, triple === compares values." },
              ],
            },
          ],
          question: "What would be printed if devRank is 5?",
          options: ["Senior Dev!", "Mid Dev", "Junior Dev", "Nothing"],
          correct: 1, xp: 10,
          explanation: "5 >= 10 is false (skip), 5 >= 5 is true (match!), so 'Mid Dev' is printed.",
        },
        {
          id: "l5b", type: "output-predict", title: "Trace the Conditions",
          code: 'let score = 85;\nlet bonus = true;\n\nif (score >= 90) {\n  console.log("A");\n} else if (score >= 80 && bonus) {\n  console.log("A-");\n} else {\n  console.log("B");\n}',
          options: ['"A"', '"A-"', '"B"', "Error"],
          correct: 1,
          explanation: "score (85) is not >= 90, so first condition fails. But 85 >= 80 is true AND bonus is true, so the && (and) condition passes.",
          trace: [
            "score = 85, bonus = true",
            "Is 85 >= 90? No — skip first block",
            "Is 85 >= 80? Yes. Is bonus true? Yes. Both conditions met (&&)",
            "Output: 'A-'",
          ],
          xp: 10,
        },
        {
          id: "l6", type: "code", title: "Write a Condition",
          prompt: 'Write an if statement that logs "Mint complete!" if nftCount is greater than 0',
          starter: "let nftCount = 3;\n// Write your if statement\n",
          solution: 'let nftCount = 3;\nif (nftCount > 0) {\n  console.log("Mint complete!");\n}',
          hint: "Use if (condition) { ... } syntax with the > operator", xp: 15,
        },
        {
          id: "l6b", type: "fix-bug", title: "Fix the Condition",
          prompt: "This code should print 'Access granted' when level is 5 or higher, but it always prints 'Access denied'. Find and fix the bug.",
          errorOutput: "Access denied",
          buggyCode: 'let level = 7;\n\nif (level = 5) {\n  console.log("Access denied");\n} else {\n  console.log("Access granted");\n}',
          solution: 'let level = 7;\n\nif (level >= 5) {\n  console.log("Access granted");\n} else {\n  console.log("Access denied");\n}',
          fixChecks: [
            { mustContain: ">=", errorMsg: "The comparison operator is wrong. Remember: = assigns, >= compares." },
            { mustNotContain: 'if (level = 5)', errorMsg: "Single = is assignment, not comparison. Use >= to check 'greater or equal'." },
          ],
          hints: [
            "Look at the operator inside the if condition. Is it comparing or assigning?",
            "Single = assigns a value. Use >= to check 'greater or equal to'.",
            "Also check: are 'Access granted' and 'Access denied' in the right blocks?",
          ],
          xp: 15,
        },
        {
          id: "l7", type: "concept", title: "Loops",
          steps: [
            {
              title: "Repeating actions",
              blocks: [
                { type: "text", content: "Loops let you repeat code without writing it multiple times. Instead of writing console.log() 100 times, you write a loop that runs 100 times." },
              ],
            },
            {
              title: "The for loop",
              blocks: [
                { type: "text", content: "A for loop has three parts: start, condition, and step:" },
                { type: "code", label: "for loop anatomy", content: '//    start     condition   step\nfor (let i = 0; i < 5;    i++) {\n  console.log("Dev #" + i);\n}\n// Prints: Dev #0, Dev #1, Dev #2, Dev #3, Dev #4' },
                { type: "list", items: [
                  "Start: let i = 0 — create counter, begin at 0",
                  "Condition: i < 5 — keep going while true",
                  "Step: i++ — add 1 to counter after each loop",
                ] },
              ],
            },
            {
              title: "The while loop",
              blocks: [
                { type: "text", content: "A while loop is simpler — it just has a condition:" },
                { type: "code", content: 'let count = 0;\nwhile (count < 3) {\n  console.log("Mining...");\n  count++;  // Don\'t forget this!\n}' },
                { type: "warn", content: "Always make sure the loop condition will eventually become false. Forgetting count++ creates an infinite loop that crashes your program!" },
              ],
            },
          ],
          question: "How many times does the for loop above print?",
          options: ["4 times", "5 times", "6 times", "Infinite times"],
          correct: 1, xp: 10,
          explanation: "i starts at 0 and goes up to (but not including) 5: 0, 1, 2, 3, 4 = five iterations.",
        },
        {
          id: "l7b", type: "reorder", title: "Build a Loop",
          prompt: "Put these lines in the correct order to create a for loop that counts from 1 to 3:",
          lines: [
            '  console.log(i);',
            'for (let i = 1; i <= 3; i++) {',
            '}',
          ],
          correctOrder: [
            'for (let i = 1; i <= 3; i++) {',
            '  console.log(i);',
            '}',
          ],
          explanation: "A for loop starts with the 'for' declaration, then the body inside { }, and closes with }.",
          xp: 10,
        },
        {
          id: "l8", type: "code", title: "Loop Challenge",
          prompt: "Write a for loop that adds numbers 1 through 5 to a variable called 'total' (start total at 0)",
          starter: "let total = 0;\n// Write your for loop\n",
          solution: "let total = 0;\nfor (let i = 1; i <= 5; i++) {\n  total += i;\n}",
          hint: "Use for (let i = 1; i <= 5; i++) and add i to total each iteration", xp: 20,
        },
        {
          id: "l8b", type: "output-predict", title: "Loop Output",
          code: 'let result = "";\nfor (let i = 3; i > 0; i--) {\n  result += i + " ";\n}\nconsole.log(result);',
          options: ['"1 2 3 "', '"3 2 1 "', '"3 2 1"', '"0 1 2 3 "'],
          correct: 1,
          explanation: "The loop counts DOWN: i starts at 3, decreases by 1 each time (i--), and stops when i is no longer > 0.",
          trace: [
            "i = 3: result = '' + '3 ' = '3 '",
            "i = 2: result = '3 ' + '2 ' = '3 2 '",
            "i = 1: result = '3 2 ' + '1 ' = '3 2 1 '",
            "i = 0: 0 > 0 is false, loop ends",
            "Output: '3 2 1 '",
          ],
          xp: 10,
        },
      ],
    },
    {
      id: "m3", title: "Functions", corp: "yai",
      lessons: [
        {
          id: "l9", type: "concept", title: "Creating Functions",
          steps: [
            {
              title: "Why functions?",
              blocks: [
                { type: "text", content: "Imagine you need to calculate XP in 10 different places. Without functions, you'd copy the same formula 10 times. If it changes, you'd fix it in 10 places." },
                { type: "highlight", content: "Functions let you write code once and reuse it anywhere. They are the building blocks of every program." },
              ],
            },
            {
              title: "Anatomy of a function",
              blocks: [
                { type: "code", label: "Function structure", content: 'function mintDev(name, rank) {\n  return "Minted: " + name + " (Rank " + rank + ")";\n}' },
                { type: "list", items: [
                  "'function' keyword — declares a new function",
                  "'mintDev' — the name you choose (camelCase convention)",
                  "'(name, rank)' — parameters: inputs your function accepts",
                  "'return' — sends a value back to whoever called the function",
                ] },
              ],
            },
            {
              title: "Calling a function",
              blocks: [
                { type: "text", content: "Creating a function doesn't run it. You must call it by name with parentheses:" },
                { type: "code", content: 'let result = mintDev("FrogDev", 42);\n// result = "Minted: FrogDev (Rank 42)"\n\n// You can call it multiple times:\nmintDev("RobotDev", 7);\nmintDev("PenguinDev", 100);' },
                { type: "text", content: "Each call runs the function body with different arguments. The function does its job and returns the result." },
              ],
            },
            {
              title: "Functions without return",
              blocks: [
                { type: "text", content: "Not every function returns a value. Some just perform actions:" },
                { type: "code", content: 'function greet(name) {\n  console.log("Welcome, " + name + "!");\n  // No return — just prints\n}\n\ngreet("Dev #42");\n// Prints: Welcome, Dev #42!' },
              ],
            },
          ],
          question: "What does the 'return' keyword do?",
          options: ["Stops the program", "Sends a value back to the caller", "Prints to console", "Declares a variable"],
          correct: 1, xp: 10,
          explanation: "'return' sends a result back to wherever the function was called, and exits the function.",
        },
        {
          id: "l9b", type: "fill-blank", title: "Complete the Function",
          prompt: "Fill in the blanks to create a function that doubles a number:",
          code: '___ double(num) {\n  ___ num * 2;\n}',
          blanks: [
            { answer: "function", placeholder: "keyword", explanation: "'function' is the keyword to declare a function" },
            { answer: "return", placeholder: "keyword", explanation: "'return' sends the result back to the caller" },
          ],
          xp: 10,
        },
        {
          id: "l10", type: "code", title: "Build a Function",
          prompt: "Write a function called 'calculateXP' that takes 'lessons' and 'bonus' parameters, and returns (lessons * 10) + bonus",
          starter: "// Define your function\n",
          solution: "function calculateXP(lessons, bonus) {\n  return (lessons * 10) + bonus;\n}",
          hint: "Use function name(params) { return expression; }", xp: 20,
        },
        {
          id: "l10b", type: "fix-bug", title: "Debug the Function",
          prompt: "This function should return the sum of two numbers, but it always returns undefined. Fix it.",
          errorOutput: "undefined",
          buggyCode: 'function add(a, b) {\n  let result = a + b;\n}\n\nconsole.log(add(3, 4));',
          solution: 'function add(a, b) {\n  let result = a + b;\n  return result;\n}\n\nconsole.log(add(3, 4));',
          fixChecks: [
            { mustContain: "return", errorMsg: "The function calculates the result but never returns it. Add a return statement." },
          ],
          hints: [
            "The function computes the result but never sends it back. What keyword is missing?",
            "Add 'return result;' before the closing } of the function.",
          ],
          xp: 15,
        },
        {
          id: "l10c", type: "output-predict", title: "Function Call Order",
          code: 'function double(n) {\n  return n * 2;\n}\n\nfunction addOne(n) {\n  return n + 1;\n}\n\nconsole.log(addOne(double(3)));',
          options: ["6", "7", "8", "Error"],
          correct: 1,
          explanation: "Inner call first: double(3) returns 6. Then addOne(6) returns 7.",
          trace: [
            "Start with the inner call: double(3)",
            "double(3): returns 3 * 2 = 6",
            "Now addOne(6): returns 6 + 1 = 7",
            "console.log(7) outputs: 7",
          ],
          xp: 10,
        },
      ],
    },
    {
      id: "m4", title: "Arrays & Objects", corp: "misanthropic",
      lessons: [
        {
          id: "l11", type: "concept", title: "Arrays",
          steps: [
            {
              title: "Lists of data",
              blocks: [
                { type: "text", content: "An array is an ordered list. Think of it like a numbered list of items — each item has a position (index)." },
                { type: "code", label: "Creating an array", content: 'let devTypes = ["Frog", "Human", "Robot", "Penguin"];' },
              ],
            },
            {
              title: "Accessing items",
              blocks: [
                { type: "text", content: "Arrays use zero-based indexing. The first element is at index 0, not 1:" },
                { type: "code", content: 'devTypes[0]  // "Frog"    (first)\ndevTypes[1]  // "Human"   (second)\ndevTypes[2]  // "Robot"   (third)\ndevTypes[3]  // "Penguin" (fourth)\n\ndevTypes.length  // 4 (total items)' },
                { type: "warn", content: "Index 0 = first item. This is a common source of confusion for beginners!" },
              ],
            },
            {
              title: "Modifying arrays",
              blocks: [
                { type: "code", label: "Common array operations", content: 'let corps = ["Closed AI", "Y.AI"];\n\ncorps.push("Mistrial");    // Add to end\ncorps.pop();               // Remove from end\ncorps.length;              // How many items\ncorps.includes("Y.AI");    // true — check if exists' },
              ],
            },
          ],
          question: "What is devTypes[2] in the array above?",
          options: ["Frog", "Human", "Robot", "Penguin"],
          correct: 2, xp: 10,
          explanation: "Index 2 is the third element (0=Frog, 1=Human, 2=Robot).",
        },
        {
          id: "l11b", type: "output-predict", title: "Array Index",
          code: 'let items = ["shield", "sword", "potion"];\nitems.push("scroll");\nconsole.log(items[3]);',
          options: ['"potion"', '"scroll"', "undefined", "Error"],
          correct: 1,
          explanation: "After push, the array is ['shield', 'sword', 'potion', 'scroll']. Index 3 is 'scroll'.",
          trace: [
            "items starts as ['shield', 'sword', 'potion'] (length 3)",
            "push('scroll') adds to end: ['shield', 'sword', 'potion', 'scroll']",
            "items[3] = 'scroll' (the new 4th element at index 3)",
          ],
          xp: 10,
        },
        {
          id: "l12", type: "code", title: "Array Operations",
          prompt: 'Create an array called "corps" with 3 corporation names, then add a 4th using .push()',
          starter: "// Create array and add an element\n",
          solution: 'let corps = ["Closed AI", "Shallow Mind", "Mistrial"];\ncorps.push("Zuck Labs");',
          hint: "Use square brackets [] for the array, then .push() to add", xp: 15,
        },
        {
          id: "l13", type: "concept", title: "Objects",
          steps: [
            {
              title: "Key-value pairs",
              blocks: [
                { type: "text", content: "Objects store data as named properties (key-value pairs). Unlike arrays where items are numbered, objects use descriptive names:" },
                { type: "code", label: "Creating an object", content: 'let dev = {\n  name: "FrogDev",\n  rank: 42,\n  corp: "Closed AI",\n  isActive: true,\n};' },
              ],
            },
            {
              title: "Reading and changing properties",
              blocks: [
                { type: "code", content: '// Read a property\ndev.name        // "FrogDev"\ndev.rank        // 42\n\n// Change a property\ndev.rank = 43;\n\n// Add a new property\ndev.xp = 500;' },
                { type: "text", content: "Use dot notation (dev.name) to access or modify properties." },
              ],
            },
            {
              title: "Objects inside arrays",
              blocks: [
                { type: "text", content: "In real apps, you often combine arrays and objects:" },
                { type: "code", content: 'let team = [\n  { name: "FrogDev", rank: 42 },\n  { name: "RobotDev", rank: 7 },\n];\n\nteam[0].name    // "FrogDev"\nteam[1].rank    // 7' },
                { type: "highlight", content: "This pattern (array of objects) is one of the most common data structures in programming." },
              ],
            },
          ],
          question: "How do you access the 'corp' property of the dev object?",
          options: ["dev.corp", 'dev["corp"]', "Both of the above", "dev->corp"],
          correct: 2, xp: 10,
          explanation: "Both dot notation (dev.corp) and bracket notation (dev['corp']) work in JavaScript.",
        },
        {
          id: "l13b", type: "fill-blank", title: "Complete the Object",
          prompt: "Fill in the blanks to create a Dev object and read its properties:",
          code: 'let myDev = {\n  name: ___,\n  level: ___,\n};\n\nconsole.log(myDev.___);',
          blanks: [
            { answer: '"NXDev"', placeholder: 'string value', explanation: "Object values follow the same type rules — strings need quotes" },
            { answer: "10", placeholder: 'number value', explanation: "Numbers don't need quotes" },
            { answer: "name", placeholder: 'property', explanation: "Use dot notation to access object properties" },
          ],
          xp: 10,
        },
        {
          id: "l14", type: "code", title: "Build an Object",
          prompt: 'Create an object called "protocol" with properties: name (string), tvl (number), and active (boolean). Then change tvl to a new value.',
          starter: "// Create your object\n",
          solution: 'let protocol = {\n  name: "DefiSwap",\n  tvl: 50000,\n  active: true,\n};\nprotocol.tvl = 75000;',
          hint: "Use { key: value } syntax. Change a property with object.key = newValue;", xp: 20,
        },
        {
          id: "l14b", type: "reorder", title: "Array Loop",
          prompt: "Arrange these lines to loop through an array and print each item:",
          lines: [
            '}',
            'let colors = ["red", "green", "blue"];',
            '  console.log(colors[i]);',
            'for (let i = 0; i < colors.length; i++) {',
          ],
          correctOrder: [
            'let colors = ["red", "green", "blue"];',
            'for (let i = 0; i < colors.length; i++) {',
            '  console.log(colors[i]);',
            '}',
          ],
          explanation: "First declare the array, then create a for loop using array.length as the limit, access each element with array[i].",
          xp: 10,
        },
      ],
    },
  ],
};
