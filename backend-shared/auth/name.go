package auth

import "errors"

func ValidateName(name string) error {
	if name == "" {
		return errors.New("name is required")
	}

	for _, r := range name {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			continue
		}
		return errors.New("name contains disallowed characters")
	}

	return nil
}
