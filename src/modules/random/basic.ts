import { isDefined } from '../../utils'

/**
 * randomly return true or false
 * @param {number} [probability] the probability to return true, must be a value between 0 and 1 (including 0 and 1)
 *
 * @example
 * ```javascript
 * Mock.Random.boolean(0.9) // true
 * ```
 */
const bool = (probability?: number): boolean => {
    if (!isDefined(probability)) {
        return Math.random() > 0.5
    }

    return Math.random() > (1 - probability)
}

/**
 * randomly return an integer
 * @param {number} [min]
 * @param {number} [max]
 */
const int = (min?: number, max?: number): number => {
    min = isDefined(min) ? parseInt('' + min, 10) : -9007199254740992 // -2^53
    max = isDefined(max) ? parseInt('' + max, 10) : 9007199254740992 // 2^53
    return  Math.round(Math.random() * (max - min)) + min
}

/**
 * randomly return a natural number (0, and positive integer)
 * @param {number} [min]
 * @param {number} [max]
 *
 * @example
 * ```javascript
 * Mock.Random.natural(10, 20) // 10
 * ```
 */
const natural = (min?: number, max?: number): number => {
    min = isDefined(min) ? parseInt('' + min, 10) : 0
    return int(min, max)
}

/**
 * randomly return a character
 * @param {string} clue 'lower', 'upper', 'number', 'symbol', 'alpha', or other given string
 */
const char = (clue?: string): string => {
    const lower = 'abcdefghijklmnopqrstuvwxyz'
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const number = '0123456789'
    const symbol = '!@#$%^&*()[]-+`~;\'\\":,./<>?|}{'
    const alpha = lower + upper

    const together = [alpha, number, symbol].join('')
    const pools = { lower, upper, number, symbol, alpha }

    const pool = !isDefined(clue) ? together : (pools[clue.toLowerCase()] || clue)
    return pool.charAt(natural(0, pool.length - 1))
}

/**
 * randomly return a float number
 * @param min
 * @param max
 * @param minDecimalLength
 * @param maxDecimalLength
 */
const float = (min?: number, max?: number, minDecimalLength?: number, maxDecimalLength?: number): number => {
    minDecimalLength = isDefined(minDecimalLength) ? minDecimalLength : 0
    maxDecimalLength = isDefined(maxDecimalLength) ? maxDecimalLength : 17

    // ensure length of decimal part is between [0, 17]
    minDecimalLength = Math.max(Math.min(minDecimalLength, 17), 0)
    maxDecimalLength = Math.max(Math.min(maxDecimalLength, 17), 0)
    const decimalLength = natural(minDecimalLength, maxDecimalLength)

    let returnNum = int(min, max) + '.'

    for (let i = 0; i < decimalLength; i++) {
        // the last dicimal number should not be zero, for it will be ignore by JS engine
        returnNum += (i < decimalLength - 1) ? char('number') : char('123456789')
    }

    return parseFloat(returnNum)
}

/**
 * randomly return a string
 *
 * - Mock.Random.str(pool, min, max)
 * - Mock.Random.str(pool, length)
 * - Mock.Random.str(min, max), equals to Mock.Random.str(undefined, min, max)
 * - Mock.Random.str(pool), equals to Mock.Random.str(pool, 3, 7)
 * - Mock.Random.str(length), equals to Mock.Random.str(undefined, length)
 * - Mock.Random.str(), equals to Mock.Random.str(3, 7)
 *
 * @param {string | number} [pool] given string, or length of string
 * @param {number} [min] length of string, or minimum length of string
 * @param {number} [max] maximum length of string
 *
 * @example
 * ```javascript
 * Mock.Random.str('abc', 1, 3) // 'bc', 'a', 'abc', 'aca'
 *
 * Mock.Random.str('abd', 1) // 'a', 'b', 'd'
 *
 * Mock.Random.str(1, 4) // 'abcd', '4d', '@!A4'
 *
 * Mock.Random.str(1) // 'a', '$', '4'
 *
 * Mock.Random.str('d') // would always be 'd', not a random result actually ^_^
 *
 * Mock.Random.str() // would randomly return a strong of length between 3 and 7, e.g., 'abc78', '78#', '1@3wrAS'
 * ```
 */
const str = (pool?: string | number, min?: number, max?: number): string => {
    let len
    if (isDefined(max)) {
        len = natural(min, max)
    } else if (isDefined(min)) {
        if (typeof pool === 'string') {
            // (pool, length) return specific length of string from given pool
            len = min
        } else if (typeof pool === 'number') {
            // (min, max) return random number (between min and max) of string
            len = natural(pool, min)
            pool = void 0
        }
    } else if (isDefined(pool)) {
        if (typeof pool === 'number') {
            // (length)
            len = pool
            pool = void 0
        } else if (typeof pool === 'string') {
            len = natural(3, 7)
        }
    } else {
        len = natural(3, 7)
    }
    let text = ''
    if (typeof pool === 'string') {
        for (let i = 0; i < len; i++) {
            text += char(pool)
        }
    }
    return text
}

/**
 * return an array of integers
 *
 * Mock.Random.range() => Mock.Random.range(0, 0, 1) => []
 * Mock.Random.range(start) => Mock.Random.range(0, start, 1)
 * Mock.Random.range(start, stop) => Mock.Random.range(start, stop, 1)
 * Mock.Random.range(start, stop, step)
 * @param {number} [start] start integer, default is 0
 * @param {number} [stop] stop integer, itself is excluded from resulting array
 * @param {number} [step] step length, default is 1
 *
 * @example
 * ```javascript
 * Mock.Random.range() // []
 * Mock.Random.range(3) // [0, 1, 2, 3]
 * Mock.Random.range(2, 4) // [2, 3, 4]
 * Mock.Random.range(2, 8, 3) // [2, 5, 7]
 * Mock.Random.range(2, 7, 3) // [2, 5] (note that 7 is not included)
 * ```
 */
const range = (start?: number, stop?: number, step?: number) => {
    if (!isDefined(start)) {
        stop = 0
        start = 0
        step = 1
    } else if (!isDefined(stop)) {
        stop = start || 0
        start = 0
        step = 1
    } else if (!isDefined(step)) {
        step = 1
    }
    const len = Math.max(Math.ceil((stop - start) / step), 0)
    let idx = 0
    const arrRange = new Array(len)
    while (idx < len) {
        arrRange[idx++] = start
        start += step
    }
    return range
}

export default {
    bool,
    boolean: bool,
    int,
    integer: int,
    natural,
    char,
    character: char,
    float,
    str,
    string: str,
    range,
}
