SHELL=/bin/bash

# DIRECTORIES
BASE_DIR = .
NODE_MODULES_DIR = $(BASE_DIR)/node_modules
DIST_DIR = $(BASE_DIR)/build
DIST_DIR = $(BASE_DIR)/dist
PACK_DIR = $(BASE_DIR)/pack
INSTALL_PREFIX = "/usr/bin"
# VERSION
ifeq ($(VERSION),)
VERSION := "0.0.1"
endif

# PACKAGES
DEB = $(DIST_DIR)/tubectl-$(VERSION).deb

# NPM STUFF
NPM_BIN = npm

# TARGET ALIASES
INSTALL_TARGET = "$(INSTALL_PREFIX)/tubectl"
NPM_TARGET = $(NODE_MODULES_DIR)
CHANGELOG_TARGET = $(PACK_DIR)/DEBIAN/changelog
BUILD_TARGET = $(BUILD_DIR) $(NPM_TARGET)

# TARGETS
.PHONY: all
all: build


.PHONY: clean
clean:	mostlyclean
	@-test ! -d $(BUILD_DIR) || rm -rfv $(BUILD_DIR)


.PHONY: mostlyclean
mostlyclean:
	@-test ! -d $(NODE_MODULES_DIR) || rm -rfv $(NODE_MODULES_DIR)
	@-test ! -f $(DIST_DIR)/* || rm -fv $(DIST_DIR)/*


.PHONY: deps
deps: npm


#.PHONY: build
#build: $(BUILD_TARGET)


.PHONY: dist
dist: deb


.PHONY: deb
deb: $(DIST_DIR)/tubectl-$(VERSION).deb

$(DIST_DIR)/tubectl-$(VERSION).deb: $(CHANGELOG_TARGET) $(BUILD_TARGET)
	@-test ! -d $(PACK_DIR) || rm -rfv $(PACK_DIR)
	@mkdir -p $(PACK_DIR)/DEBIAN
	@cp $(BASE_DIR)/packaging/debian/control $(PACK_DIR)/DEBIAN/control
	@sed -i s/'{version}'/$(VERSION)/g $(PACK_DIR)/DEBIAN/control
	@mkdir -p $(PACK_DIR)/$(INSTALL_PREFIX)
	@cp  $(DIST_DIR)/tubectl-linux-x64 $(PACK_DIR)/$(INSTALL_PREFIX)/tubectl
	@-test -d $(DIST_DIR) || mkdir $(DIST_DIR)
	@dpkg-deb --build $(PACK_DIR) $@
	@rm -rf $(PACK_DIR)


.PHONY: changelog
changelog: $(CHANGELOG_TARGET)

$(CHANGELOG_TARGET): CHANGELOG.md
	@-test -d $(@D) || mkdir -p $(@D)
	@v=""
	@stable="stable"
	@author=""
	@date=""
	@changes=""
	@-test ! -f $@ || rm $@

	@while read l; \
	do \
		if [ "$${l:0:2}" == "##" ]; \
		then \
	 		if [ "$$v" != "" ]; \
	 		then \
	 			echo "tubectl ($$v) $$stable; urgency=low" >> $@; \
	 			echo -e "$$changes" >> $@; \
	 			echo >>  $@; \
	 			echo " -- $$author  $$date" >> $@; \
	 			echo >>  $@; \
	 			v=""; \
	 			stable="stable"; \
	 			author=";" \
	 			date=";" \
	 			changes=""; \
	 		fi; \
	 		v=$${l:3}; \
			if [[ "$$v" == *"RC"* ]]; \
	 	 	then \
	 			stable="unstable"; \
	 		elif [[ "$$v" == *"BETA"* ]]; \
	 		then \
	 			stable="unstable"; \
	 		elif [[ "$$v" == *"ALPHA"* ]]; \
	 		then \
	 			stable="unstable"; \
	 		elif [[ "$$v" == *"dev"* ]]; \
			then \
	 			stable="unstable"; \
	 		fi \
	 	elif [ "$${l:0:5}" == "**Mai" ]; \
	 	then \
	 		p1=`echo $$l | cut -d '>' -f1`; \
	 		p2=`echo $$l | cut -d '>' -f2`; \
	 		author="$${p1:16}>"; \
	 		date=$${p2:13}; \
	 		date=`date -d"$$date" +'%a, %d %b %Y %H:%M:%S %z'`; \
			if [ $$? -ne 0 ]; \
			then \
				date=`date +'%a, %d %b %Y %H:%M:%S %z'`; \
			fi; \
			echo $$date; \
	 	elif [ "$${l:0:2}" == "* " ]; \
	 	then \
			changes="  $$changes\n  $$l"; \
	 	fi; \
	done < $<
	@echo generated $@ from $<


.PHONY: npm
npm: $(NPM_TARGET)

$(NPM_TARGET) : $(BASE_DIR)/package.json
	@test "`$(NPM_BIN) install --dry-run 2>&1 >/dev/null | grep Failed`" == ""
	$(NPM_BIN) run install
	$(NPM_BIN) update
	@touch $@


.PHONY: build
build: $(BUILD_TARGET)

$(BUILD_TARGET) : $(BASE_DIR)/build
	@test "`$(NPM_BIN) install --dry-run 2>&1 >/dev/null | grep Failed`" == ""
	$(NPM_BIN) run build
	@touch $@


.PHONY: install
install: $(INSTALL_TARGET)

$(INSTALL_TARGET): $(BUILD_TARGET)
	@cp -Rp $(DIST_DIR)/tubectl-linux-x64 $(INSTALL_PREFIX)/tubectl
	@chmod +x $(INSTALL_PREFIX)/tubectl
