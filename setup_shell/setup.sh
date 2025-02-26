#!/bin/bash

# Install Oh My Zsh and set as default shell
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh) --skip-chsh --unattended"
echo "Oh My Zsh installed."

# Setup dot files
cp ./.zshrc ~/.zshrc
cp ./.zshrc_custom ~/.zshrc_custom
echo "Dot files copied."

# Install OMZ plugins
# zsh-autosuggestions
git clone https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions
# zsh-syntax-highlighting
git clone https://github.com/zsh-users/zsh-syntax-highlighting.git ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting
echo "Plugins installed."

# Install Dracula theme
git clone https://github.com/dracula/zsh.git
cp ./zsh/dracula.zsh-theme ~/.oh-my-zsh/themes/dracula.zsh-theme
mkdir -p ~/.oh-my-zsh/themes/lib
cp ./zsh/lib/async.zsh ~/.oh-my-zsh/themes/lib/async.zsh
rm -rf ./zsh
echo "Dracula theme installed."

echo "Setup complete. Please restart your terminal or run 'source ~/.zshrc' to apply changes."
