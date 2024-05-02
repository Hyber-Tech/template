# Coding Guidelines

## Overview
This document outlines the coding standards and practices to be followed within this project. Adhering to these guidelines ensures code consistency, maintainability, and readability.

### 1. Avoid Function Duplication
- **Description:** Ensure that each function is unique. If a function already exists, use it instead of creating a new one.
- **Example:** If you have a function `calculate_average()` in a utility module, call it instead of writing a new one elsewhere.

### 2. Naming Conventions
- **Description:** Use lowercase and underscores for naming files, folders, and functions (snake_case).
- **Example:** Use `data_processing.py`, not `DataProcessing.py` or `dataProcessing.py`.

### 3. Confidential Information
- **Description:** Store all sensitive information such as passwords in a `.env` file, not directly in the codebase.
- **Example:** Use `API_KEY = os.getenv('API_KEY')` to access an API key stored in `.env`.

### 4. Sensitive Data in `.gitignore`
- **Description:** Ensure that sensitive files like logs, data dumps, or configuration files are listed in `.gitignore`.
- **Example:** Add entries like `*.log`, `secret_data.csv` to `.gitignore` to prevent their upload to the repository.

### 5. Commenting and Documentation
- **Description:** Write comments as you code to explain the purpose of functions and logic. Avoid placing function tests directly in the flow of the file; use a dedicated `main` function or test module instead.
- **Example:**
  ```python
  def add_numbers(a, b):
      # Returns the sum of two numbers
      return a + b
  
  
  def main():
      # Test the function
      print(add_numbers(5, 3))
  
  
  if __name__ == "__main__":
      # Call only the main function
      main()
  
### 6. Explicit Naming
- **Description:** Use clear and descriptive names for functions, variables, and other identifiers.
- **Example:** Use `read_user_data()` instead of `rud()`; name a variable `customer_list` instead of `clst`.

### 7. Code Formatting
- **Description:** Keep the code well-formatted and readable. Use whitespace to separate sections and avoid complex syntax that is hard to read.
- **Example:** Use clear for-loops and avoid deep nesting. Prefer list comprehensions over complicated map/filter constructs if it improves readability.
