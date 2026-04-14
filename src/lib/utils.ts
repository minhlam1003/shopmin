import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function numberToWordsVietnamese(number: number): string {
  if (number === 0) return "Không đồng";
  
  const units = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];
  const digits = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  
  function readThreeDigits(n: number, isFirstGroup: boolean): string {
    let res = "";
    const h = Math.floor(n / 100);
    const t = Math.floor((n % 100) / 10);
    const u = n % 10;
    
    if (h > 0 || !isFirstGroup) {
      res += digits[h] + " trăm ";
    }
    
    if (t > 0) {
      if (t === 1) res += "mười ";
      else res += digits[t] + " mươi ";
    } else if (h > 0 && u > 0) {
      res += "lẻ ";
    }
    
    if (u > 0) {
      if (t > 1 && u === 1) res += "mốt";
      else if (t > 0 && u === 5) res += "lăm";
      else res += digits[u];
    }
    
    return res.trim();
  }
  
  let str = "";
  let groupIdx = 0;
  let tempArr = [];
  let n = Math.abs(number);
  
  while (n > 0) {
    tempArr.push(n % 1000);
    n = Math.floor(n / 1000);
  }
  
  for (let i = tempArr.length - 1; i >= 0; i--) {
    const groupRead = readThreeDigits(tempArr[i], i === tempArr.length - 1);
    if (groupRead) {
      str += groupRead + " " + units[i] + " ";
    }
  }
  
  str = str.trim();
  if (str.length > 0) {
    str = str.charAt(0).toUpperCase() + str.slice(1) + " đồng chẵn";
  }
  
  return str;
}
