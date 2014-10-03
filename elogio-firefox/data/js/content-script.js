new Elogio(
    ['config', 'utils', 'dom', 'imageDecorator', 'locator', 'bridge'],
    function (modules) {
        'use strict';
        var locator = modules.getModule('locator'),
            imageDecorator = modules.getModule('imageDecorator'),
            dom = modules.getModule('dom'),
            config = modules.getModule('config'),
            bridge = modules.getModule('bridge');

        /*
         =======================
         PRIVATE MEMBERS
         =======================
         */
        var observer;

        function processDocument() {
            locator.findImages(document, null, function (imageObj) {
                bridge.emit(bridge.events.newImageFound, imageObj);
            }, function () {
                //on error
            }, function () {
                //on finished
                bridge.emit(bridge.events.pageProcessingFinished);
            });
        }

        function undecorate() {
            var elements = dom.getElementsByAttribute(config.ui.decoratedItemAttribute, document);
            var i, n;
            for (i = 0, n = elements.length; i < n; i++) {
                imageDecorator.undecorate(elements[i], document);
            }
            // secondary remove uuid from all elements which we marks
            var elementsWithUUID = dom.getElementsByAttribute(config.ui.dataAttributeName, document);
            for (i = 0, n = elementsWithUUID.length; i < n; i++) {
                if (elementsWithUUID[i].hasAttribute(config.ui.dataAttributeName)) {
                    elementsWithUUID[i].removeAttribute(config.ui.dataAttributeName);
                }
            }
            if (observer) {
                observer.disconnect();
            }
        }

        // Initialize bridge
        bridge.registerClient(self.port);

        window.addEventListener('pageshow', function () {
            bridge.emit(bridge.events.pageShowEvent);
        }, false);

        //is needed for undecorate page if it from the cache
        bridge.on(bridge.events.pageShowEvent, function () {
            undecorate();
        });

        // Subscribe for events
        bridge.on(bridge.events.configUpdated, function (updatedConfig) {
            config.ui.imageDecorator.iconUrl = updatedConfig.ui.imageDecorator.iconUrl;
            if (document.body) {
                if (updatedConfig.ui.highlightRecognizedImages) {
                    if (document.body.className.indexOf('elogio-highlight') < 0) {
                        document.body.className += ' elogio-highlight';
                    }
                } else {
                    document.body.className = document.body.className.replace(/\s?elogio-highlight\b/, '');
                }
            }
        });
        bridge.on(bridge.events.pluginStopped, function () {
            undecorate();
        });
        bridge.on(bridge.events.newImageFound, function (imageObj) {
            var element = dom.getElementByUUID(imageObj.uuid, document);
            if (element) {
                imageDecorator.decorate(element, document, function () {
                    bridge.emit(bridge.events.onImageAction, imageObj);
                });
            }
        });
        bridge.on(bridge.events.onImageAction, function (imageObj) {
            var elem = dom.getElementByUUID(imageObj.uuid, document);
            if (elem) {
                elem.scrollIntoView();
            }
        });
        bridge.on(bridge.events.pluginActivated, function () {
            if (document.body) {
                observer.observe(document.body, { attributes: false, childList: true, subtree: true });
            }
        });
        bridge.on(bridge.events.startPageProcessing, processDocument);
        // Experiment with MutationObserver
        // create an observer instance
        observer = new MutationObserver(function (mutations) {
            var nodesToBeProcessed = [];
            mutations.forEach(function (mutation) {
                var i;
                for (i = 0; i < mutation.addedNodes.length; i += 1) {
                    if (mutation.addedNodes[i].nodeType === Node.ELEMENT_NODE) {
                        nodesToBeProcessed[nodesToBeProcessed.length] = mutation.addedNodes[i];
                    }
                }
                // remove images from storage and panel once they disappear from DOM
                for (i = 0; i < mutation.removedNodes.length; i += 1) {
                    if (mutation.removedNodes[i].nodeType === Node.ELEMENT_NODE) {
                        // if node is removed element
                        var uuid = mutation.removedNodes[i].getAttribute(config.ui.dataAttributeName),
                            elements;
                        if (uuid) {
                            bridge.emit(bridge.events.onImageRemoved, uuid);
                        }
                        // check if node has another removed elements
                        elements = dom.getElementsByAttribute(config.ui.dataAttributeName, mutation.removedNodes[i]);
                        if (elements) {
                            for (var j = 0; j < elements.length; j++) {
                                uuid = elements[j].getAttribute(config.ui.dataAttributeName);
                                if (uuid) {
                                    bridge.emit(bridge.events.onImageRemoved, uuid);
                                }
                            }
                        }
                    }
                }
                processDocument();
            });
        });
    }
);