package auth

import (
	"errors"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

const specialChars = "!\"#$%&'()*+-/:<=>?@[\\]^_`{|}~"

func HashPassword(password string) []byte {
	hash, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost) // create
	return hash
}

func CompareHashAndPassword(hash []byte, password string) bool {
	err := bcrypt.CompareHashAndPassword(hash, []byte(password))
	return err == nil
}

func ValidatePassword(password string) error {
	if len(password) < 8 {
		return errors.New("password must be at least 8 characters")
	}

	hasSpecial := false
	for _, r := range password {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9':
		case strings.ContainsRune(specialChars, r):
			hasSpecial = true
		default:
			return errors.New("password contains disallowed characters")
		}
	}

	if !hasSpecial {
		return errors.New("password must contain at least one special character")
	}

	return nil
}
