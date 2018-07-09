/**
 * gbRichEdit5 - getButterfly Rich Text Editor plugin - https://getbutterfly.com/
 * 
 * @author	Ciprian Popescu
 * @version 5.9.1
 * 
 * Licensed under The MIT License
 * https://opensource.org/licenses/mit-license.php
 * 
 */

/* eslint-env browser */
/* jslint-env browser */
/* global window */
/* global document */
/* global console */
/* global jQuery */

// define the gre plugin
(function ($) {
	if (typeof $.fn.gre === 'undefined') {
		// define default options
		var defaults = {
			content_css_url: '/gre/gre.css',
			height: 250
		};
		$.fn.gre = function (options) {
			$.fn.gre.html = function (iframe) {
				return iframe.contentWindow.document.getElementsByTagName('body')[0].innerHTML;
			};

			// build main options before element iteration
			var opts = $.extend(defaults, options);

			// iterate and construct the rich text editors
			return this.each(function () {
				var textarea = $(this),
                    iframe;
				var element_id = textarea.prop('id');

				// enable design mode
				function enableDesignMode() {
					var content = textarea.val();

					// Mozilla needs this to display caret
					if ($.trim(content) === '') {
						content = '';
                    }

					// already created? show/hide
					if (iframe) {
						textarea.hide();
						$(iframe).contents().find('body').html(content);
						$(iframe).show();
						$('#toolbar-' + element_id).remove();
						textarea.before(toolbar());
						return true;
					}

					// for compatibility reasons, need to be created this way
                    iframe = document.createElement('iframe');
                    iframe.frameBorder = 0;
					iframe.frameMargin = 0;
					iframe.framePadding = 0;
					iframe.height = opts.height;

					if (textarea.prop('class')) {
						iframe.className = textarea.prop('class');
                    }
					if (textarea.prop('id')) {
						iframe.id = element_id;
                    }
					if (textarea.prop('name')) {
						iframe.title = textarea.prop('name');
                    }

					textarea.after(iframe);

					var css = '';
					if (opts.content_css_url) {
						css = "<link rel='stylesheet' href='" + opts.content_css_url + "'>";
                    }

					var doc = '<!doctype html><html><head>' + css + '</head><body class="frameBody">' + content + '</body></html>';
					tryEnableDesignMode(doc, function () {
						$('#toolbar-' + element_id).remove();
						textarea.before(toolbar());
						// hide textarea
						textarea.hide();
					});
				}

				function tryEnableDesignMode(doc, callback) {
					if (!iframe) {
						return false;
                    }

					iframe.contentWindow.document.open();
					iframe.contentWindow.document.write(doc);
					iframe.contentWindow.document.close();

					if (document.contentEditable) {
						iframe.contentWindow.document.designMode = 'On';
						callback();
						return true;
					} else if (document.designMode !== null) {
						iframe.contentWindow.document.designMode = 'on';
						callback();
						return true;
					}
					setTimeout(function () {
                        tryEnableDesignMode(doc, callback);
                    }, 500);

                    return false;
				}

				function disableDesignMode(submit) {
					var content = $(iframe).contents().find('body').html();

					if ($(iframe).is(':visible')) {
						textarea.val(content);
                    }

					if (submit !== true) {
						textarea.show();
						$(iframe).hide();
					}
				}

				// create toolbar and bind events to its elements
				function toolbar() {
					var tb = $("\
						<div class='gre-toolbar' id='toolbar-"+ element_id +"'>\
							<select class='blocktype'>\
								<option value=''>Block style</option>\
								<option value='p'>Paragraph</option>\
								<option value='h3'>Title</option>\
								<option value='address'>Address</option>\
							</select>\
							<a href='#' class='bold'><i class='fa fa-bold'></i></a>\
							<a href='#' class='italic'><i class='fa fa-italic'></i></a>\
							<a href='#' class='underline'><i class='fa fa-underline'></i></a>\
							<a href='#' class='link'><i class='fa fa-link'></i></a>\
						</div>\
					");

					$('select', tb).change(function () {
						var index = this.selectedIndex;
						if (index !== 0) {
							var selected = this.options[index].value;
							formatText('formatblock', '<' + selected + '>');
						}
					});
                    $('.blocktype', tb).hide();
					$('.bold', tb).click(function () { formatText('bold');return false; });
					$('.italic', tb).click(function () { formatText('italic');return false; });
					$('.underline', tb).click(function () { formatText('underline');return false; });
					$('.strikeThrough', tb).click(function () { formatText('strikeThrough');return false; });

					$('.superscript', tb).click(function () { formatText('superscript');return false; });
					$('.subscript', tb).click(function () { formatText('subscript');return false; });

					$('.unorderedlist', tb).click(function () { formatText('insertunorderedlist');return false; });
					$('.orderedlist', tb).click(function () { formatText('insertorderedlist');return false; });

					$('.justifyLeft', tb).click(function () { formatText('justifyLeft');return false; });
					$('.justifyCenter', tb).click(function () { formatText('justifyCenter');return false; });
					$('.justifyRight', tb).click(function () { formatText('justifyRight');return false; });
					$('.justifyFull', tb).click(function () { formatText('justifyFull');return false; });

					$('.insertHorizontalRule', tb).click(function () { formatText('insertHorizontalRule');return false; });

					$('.link', tb).click(function(){
						var p = prompt('Insert URL address (starting with https://):');
						if(p)
							formatText('CreateLink', p);
						return false;
					});

					// * more possible options
					// decreaseFontSize // Adds a SMALL tag around the selection or at the insertion point. (Not supported by Internet Explorer.)
					// foreColor // Changes a font color for the selection or at the insertion point. This requires a color value string to be passed in as a value argument.
					// indent/outdent // Indents the line containing the selection or insertion point. In Firefox, if the selection spans multiple lines at different levels of indentation, only the least indented lines in the selection will be indented.
					// removeFormat
					// unlink

					/*
					insertHTML
					Inserts an HTML string at the insertion point (deletes selection). Requires a valid HTML string to be passed in as a value argument. (Not supported by Internet Explorer.)
					*/

					$('.image', tb).click(function(){
						var p = prompt('Insert image URL address (starting with https://):');
						if(p)
							formatText('InsertImage', p);
						return false;
					});

					// Insert HTML code
					$('.insertHTML', tb).click(function(){
						var p = prompt('Insert HTML code:');
						if(p)
							formatText('insertHTML', p);
						return false;
					});

					$('.disable', tb).click(function(){
						disableDesignMode();
						var edm = $('<small><a class="gre-minilink" href="#"><i class="fa fa-bars"></i></a></small>');
						tb.empty().append(edm);
						edm.click(function(e){
							e.preventDefault();
							enableDesignMode();
							$(this).remove();
						});
						return false;
					});

					$(iframe).parents('form').submit(function(){
						disableDesignMode(true);
					});

					var iframeDoc = $(iframe.contentWindow.document);

					var select = $('select', tb)[0];
					iframeDoc.mouseup(function(){
						setSelectedType(getSelectionElement(), select);
						return true;
					});

					return tb;
				}

				function formatText(command, option) {
					iframe.contentWindow.focus();
					iframe.contentWindow.document.execCommand(command, false, option);

					// convert nasty markup to light xhtml
					var markup = iframe.contentWindow.document.body.innerHTML;

					markup = markup.replace(/<span\s*(class="Apple-style-span")?\s*style="font-weight:\s*bold;">([^<]*)<\/span>/ig, '<strong>$2</strong>');
					markup = markup.replace(/<span\s*(class="Apple-style-span")?\s*style="font-style:\s*italic;">([^<]*)<\/span>/ig, '<em>$2</em>');

					iframe.contentWindow.document.body.innerHTML = markup;
					iframe.contentWindow.focus();
				}

				function setSelectedType(node, select) {
					while(node.parentNode) {
						var nName = node.nodeName.toLowerCase();
						for(var i=0;i<select.options.length;i++) {
							if(nName == select.options[i].value) {
								select.selectedIndex = i;
								return true;
							}
						}
						node = node.parentNode;
					}
					select.selectedIndex = 0;
					return true;
				}

				function getSelectionElement() {
                    var selection,
                        range,
                        node;

                    if (iframe.contentWindow.document.selection) {
						// IE selections
						selection = iframe.contentWindow.document.selection;
						range = selection.createRange();
						node = range.parentElement();
					} else {
						// Mozilla selections
						selection = iframe.contentWindow.getSelection();
						range = selection.getRangeAt(0);
						node = range.commonAncestorContainer;
					}

                    return node;
				}

				enableDesignMode();
			}); //return this.each
		}; // gre
	} // if
})(jQuery);
